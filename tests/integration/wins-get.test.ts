import { describe, it, expect, beforeAll } from "vitest";

// Integration test for the user-scoped query behind GET /api/wins/:id.
// Exercises the PGlite door directly (see smoke.test.ts) — the route
// handler itself only adds currentUserId()/Response wiring around this.
type PrismaClient = import("@project/db").PrismaClient;
let prisma: PrismaClient;
let getWin: typeof import("@project/domain").getWin;

beforeAll(async () => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  const db = await import("@project/db");
  prisma = db.prisma;
  ({ getWin } = await import("@project/domain"));
}, 30000);

describe("getWin", () => {
  it("returns a win owned by the requesting user", async () => {
    const owner = await prisma.user.create({ data: { email: "owner@example.com" } });
    const win = await prisma.win.create({
      data: {
        reflection: "Finished a 5k",
        category: "FITNESS",
        latitude: 37.77,
        longitude: -122.42,
        userId: owner.id,
      },
    });

    const result = await getWin({ userId: owner.id, id: win.id });
    expect(result?.id).toBe(win.id);
  });

  it("returns null for a win owned by another user", async () => {
    const owner = await prisma.user.create({ data: { email: "owner2@example.com" } });
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } });
    const win = await prisma.win.create({
      data: {
        reflection: "Shipped a feature",
        category: "CAREER",
        latitude: 40.71,
        longitude: -74.0,
        userId: owner.id,
      },
    });

    const result = await getWin({ userId: stranger.id, id: win.id });
    expect(result).toBeNull();
  });

  it("returns null for an id that doesn't exist", async () => {
    const result = await getWin({ userId: "nobody", id: "00000000-0000-0000-0000-000000000000" });
    expect(result).toBeNull();
  });
});
