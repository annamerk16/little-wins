import { beforeAll, describe, expect, it } from "vitest";
import { seedDemoData } from "../../apps/migrate/src/seed-data";

let prisma: import("@project/db").PrismaClient;

beforeAll(async () => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  ({ prisma } = await import("@project/db"));
}, 30000);

describe("demo seed", () => {
  it("creates one sample per category, is repeatable, and preserves edits and unrelated users", async () => {
    await seedDemoData(prisma);
    const first = await prisma.win.findMany({ where: { userId: "demo-user" } });
    expect(first).toHaveLength(4);
    expect(first.map((win) => win.category).sort()).toEqual(["ACADEMIC", "CAREER", "FITNESS", "PERSONAL"]);
    await prisma.win.update({ where: { id: "demo-win-fitness" }, data: { reflection: "My edited reflection" } });
    await prisma.user.update({ where: { id: "demo-user" }, data: { name: "My edited name" } });
    const owner = await prisma.user.create({ data: { email: "seed-other@example.com" } });
    const other = await prisma.win.create({ data: {
      userId: owner.id, reflection: "Leave this alone", category: "CAREER", latitude: 1, longitude: 2,
    } });

    await seedDemoData(prisma);
    expect(await prisma.win.count({ where: { userId: "demo-user" } })).toBe(4);
    expect(await prisma.win.findUnique({ where: { id: "demo-win-fitness" } })).toMatchObject({ reflection: "My edited reflection" });
    expect(await prisma.user.findUnique({ where: { id: "demo-user" } })).toMatchObject({ name: "My edited name" });
    expect(await prisma.win.findUnique({ where: { id: other.id } })).toEqual(other);
  });

  it("rolls back the entire seed if any sample cannot be written", async () => {
    await prisma.win.deleteMany({ where: { userId: "demo-user" } });
    await prisma.user.delete({ where: { id: "demo-user" } });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_demo_career() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.id = 'demo-win-career' THEN RAISE EXCEPTION 'seed test'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_seed BEFORE INSERT ON "Win" FOR EACH ROW EXECUTE FUNCTION reject_demo_career()`);
    try {
      await expect(seedDemoData(prisma)).rejects.toThrow();
      expect(await prisma.user.findUnique({ where: { id: "demo-user" } })).toBeNull();
      expect(await prisma.win.count({ where: { userId: "demo-user" } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER reject_seed ON "Win"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION reject_demo_career()`);
    }
  });
});
