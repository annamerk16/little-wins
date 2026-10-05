import { beforeAll, describe, expect, it } from "vitest";

// Integration tests for the owner-scoped database operation behind
// DELETE /api/wins/:id. PGlite runs Postgres in memory without local services.
type PrismaClient = import("@project/db").PrismaClient;
let prisma: PrismaClient;
let deleteWin: typeof import("@project/domain").deleteWin;

beforeAll(async () => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  const db = await import("@project/db");
  prisma = db.prisma;
  ({ deleteWin } = await import("@project/domain"));
}, 30000);

describe("deleteWin", () => {
  it("deletes a win owned by the requesting user", async () => {
    const owner = await prisma.user.create({
      data: { email: "delete-owner@example.com" },
    });
    const win = await prisma.win.create({
      data: {
        reflection: "Completed the endpoint",
        category: "ACADEMIC",
        latitude: 40.74,
        longitude: -73.82,
        userId: owner.id,
      },
    });

    await expect(deleteWin({ userId: owner.id, id: win.id })).resolves.toBe(true);
    await expect(prisma.win.findUnique({ where: { id: win.id } })).resolves.toBeNull();
    await expect(deleteWin({ userId: owner.id, id: win.id })).resolves.toBe(false);
  });

  it("does not delete another user's win", async () => {
    const owner = await prisma.user.create({
      data: { email: "delete-owner-2@example.com" },
    });
    const stranger = await prisma.user.create({
      data: { email: "delete-stranger@example.com" },
    });
    const win = await prisma.win.create({
      data: {
        reflection: "Protected from another user",
        category: "PERSONAL",
        latitude: 40.75,
        longitude: -73.83,
        userId: owner.id,
      },
    });

    await expect(deleteWin({ userId: stranger.id, id: win.id })).resolves.toBe(false);
    await expect(prisma.win.findUnique({ where: { id: win.id } })).resolves.toMatchObject({
      id: win.id,
      userId: owner.id,
    });
  });

  it("returns false when the win does not exist", async () => {
    await expect(
      deleteWin({
        userId: "nobody",
        id: "00000000-0000-0000-0000-000000000000",
      })
    ).resolves.toBe(false);
  });
});
