import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUserId: vi.fn<() => Promise<string | null>>(),
  deleteWin: vi.fn<(input: { userId: string; id: string }) => Promise<boolean>>(),
  getWin: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../packages/auth/src/index.ts", () => ({
  currentUserId: mocks.currentUserId,
}));
vi.mock("../../packages/domain/src/index.ts", () => ({
  deleteWin: mocks.deleteWin,
  getWin: mocks.getWin,
}));
vi.mock("../../packages/log/src/index.ts", () => ({
  log: { error: mocks.logError },
}));

import { DELETE } from "../../apps/web/app/api/wins/[id]/route";

function request(id = "win-1") {
  return DELETE(new Request(`http://localhost/api/wins/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUserId.mockResolvedValue("owner-1");
  mocks.deleteWin.mockResolvedValue(true);
});

describe("DELETE /api/wins/:id", () => {
  it("returns 204 with an empty body after deleting an owned win", async () => {
    const response = await request();

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
    expect(mocks.deleteWin).toHaveBeenCalledWith({ userId: "owner-1", id: "win-1" });
  });

  it("returns the shared 404 response when no owned win matches", async () => {
    mocks.deleteWin.mockResolvedValue(false);

    const response = await request("foreign-or-missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Win not found" },
    });
  });

  it("returns 401 without attempting deletion when no user is resolved", async () => {
    mocks.currentUserId.mockResolvedValue(null);

    const response = await request();

    expect(response.status).toBe(401);
    expect(mocks.deleteWin).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    });
  });

  it("logs unexpected failures and returns a safe 500 response", async () => {
    const error = new Error("database unavailable");
    mocks.deleteWin.mockRejectedValue(error);

    const response = await request();

    expect(response.status).toBe(500);
    expect(mocks.logError).toHaveBeenCalledWith(
      { err: error, route: "DELETE /api/wins/:id" },
      "Failed to delete win"
    );
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unable to delete win" },
    });
  });
});
