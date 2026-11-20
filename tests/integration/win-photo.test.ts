import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUserId: vi.fn<() => Promise<string | null>>(),
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../packages/auth/src/index.ts", () => ({
  currentUserId: mocks.currentUserId,
  AuthUnavailableError: class extends Error {},
}));
vi.mock("../../packages/services/src/index.ts", () => ({
  uploadAttachment: mocks.uploadAttachment,
  downloadAttachment: mocks.downloadAttachment,
}));
vi.mock("../../packages/log/src/index.ts", () => ({ log: { error: mocks.logError } }));

const origin = "http://localhost";
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2nEAAAAASUVORK5CYII=", "base64",
));
const maxPhotoBytes = 5 * 1024 * 1024;

let photos: typeof import("../../apps/web/app/api/wins/[id]/photo/route");
let wins: typeof import("../../apps/web/app/api/wins/route");
let winDetails: typeof import("../../apps/web/app/api/wins/[id]/route");
let owner: string;
let stranger: string;

beforeAll(async () => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  const { prisma } = await import("../../packages/db/src/index");
  owner = (await prisma.user.create({ data: { email: "photo-owner@example.com" } })).id;
  stranger = (await prisma.user.create({ data: { email: "photo-stranger@example.com" } })).id;
  photos = await import("../../apps/web/app/api/wins/[id]/photo/route");
  wins = await import("../../apps/web/app/api/wins/route");
  winDetails = await import("../../apps/web/app/api/wins/[id]/route");
}, 30_000);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUserId.mockResolvedValue(owner);
  mocks.uploadAttachment.mockImplementation(async (id, filename) => `${id}/${filename}`);
});

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function upload(id: string, photo = new File([png], "photo.png", { type: "image/png" }), requestOrigin = origin) {
  const body = new FormData();
  body.set("photo", photo);
  return photos.PUT(new Request(`${origin}/api/wins/${id}/photo`, {
    method: "PUT", headers: { Origin: requestOrigin }, body,
  }), context(id));
}

function readPhoto(id: string) {
  return photos.GET(new Request(`${origin}/api/wins/${id}/photo`), context(id));
}

async function createWin(reflection: string, photoUrl?: string) {
  const response = await wins.POST(new Request(`${origin}/api/wins`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ reflection, category: "PERSONAL", latitude: 0, longitude: 0, photoUrl }),
  }));
  expect(response.status).toBe(201);
  const { win } = await response.json();
  return win as { id: string; photoUrl: string | null };
}

async function listWins() {
  const response = await wins.GET(new Request(`${origin}/api/wins`));
  expect(response.status).toBe(200);
  return (await response.json()).wins;
}

describe("win photos", () => {
  it("keeps the win through storage failure, attaches on retry, and serves only the winning blob", async () => {
    const win = await createWin("Saved through an outage");
    const photoUrl = `/api/wins/${win.id}/photo`;
    mocks.uploadAttachment.mockRejectedValueOnce(new Error("Azurite is offline"));

    const failed = await upload(win.id);
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe("STORAGE_UNAVAILABLE");
    expect((await listWins()).find((entry: { id: string }) => entry.id === win.id).photoUrl).toBeNull();

    expect((await upload(win.id)).status).toBe(204);
    expect((await upload(win.id)).status).toBe(204);
    expect(mocks.uploadAttachment).toHaveBeenCalledTimes(2);
    const [id, filename, mime, contents] = mocks.uploadAttachment.mock.calls[1];
    expect(id).toBe(win.id);
    expect(mime).toBe("image/png");
    expect(new Uint8Array(contents)).toEqual(png);
    mocks.downloadAttachment.mockResolvedValueOnce({ data: png, contentType: mime });
    const image = await readPhoto(win.id);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
    expect(mocks.downloadAttachment.mock.calls[0][0]).toBe(`${id}/${filename}`);

    const listed = (await listWins()).filter((entry: { id: string }) => entry.id === win.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].photoUrl).toBe(photoUrl);
    expect(listed[0]).not.toHaveProperty("photoBlobKey");
    const details = await winDetails.GET(new Request(`${origin}/api/wins/${win.id}`), context(win.id));
    expect((await details.json()).win.photoUrl).toBe(photoUrl);
  });

  it("enforces session, Origin, and ownership before touching storage", async () => {
    const win = await createWin("Private attachment");
    expect((await readPhoto(win.id)).status).toBe(404);
    expect((await upload(win.id, undefined, "https://elsewhere.test")).status).toBe(403);
    expect((await upload(win.id)).status).toBe(204);
    mocks.uploadAttachment.mockClear();

    mocks.currentUserId.mockResolvedValue(stranger);
    expect((await upload(win.id)).status).toBe(404);
    expect((await readPhoto(win.id)).status).toBe(404);
    expect((await upload("missing")).status).toBe(404);
    mocks.currentUserId.mockResolvedValue(null);
    expect((await upload(win.id)).status).toBe(401);
    expect((await readPhoto(win.id)).status).toBe(401);
    expect(mocks.uploadAttachment).not.toHaveBeenCalled();
    expect(mocks.downloadAttachment).not.toHaveBeenCalled();
  });

  it("rejects oversized and unsupported files and accepts the exact limit", async () => {
    const win = await createWin("Check photo validation");
    const unsupported = new File(["not a photo"], "photo.png", { type: "image/png" });
    expect((await upload(win.id, unsupported)).status).toBe(400);
    const oversized = new File([png, new Uint8Array(maxPhotoBytes)], "large.png");
    expect((await upload(win.id, oversized)).status).toBe(400);
    const oversizedBody = new File([png, new Uint8Array(maxPhotoBytes + 128 * 1024)], "large.png");
    expect((await upload(win.id, oversizedBody)).status).toBe(400);
    expect(mocks.uploadAttachment).not.toHaveBeenCalled();

    const exactSize = new File([png, new Uint8Array(maxPhotoBytes - png.length)], "limit.png");
    expect((await upload(win.id, exactSize)).status).toBe(204);
    expect(mocks.uploadAttachment).toHaveBeenCalledOnce();
  });

  it("preserves an existing photo URL until a managed photo is attached", async () => {
    const legacyUrl = "https://example.com/photo.png";
    const win = await createWin("Legacy photo", legacyUrl);
    expect(win.photoUrl).toBe(legacyUrl);
    expect((await listWins()).find((entry: { id: string }) => entry.id === win.id).photoUrl).toBe(legacyUrl);
  });
});
