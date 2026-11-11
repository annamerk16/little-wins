import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// Use the existing database workspace's PGlite dependency; no new test engine.
const dbRequire = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const { PGlite } = dbRequire("@electric-sql/pglite");
const migration = (name: string) => readFile(new URL(`../../packages/db/prisma/migrations/${name}`, import.meta.url), "utf8");

describe("append-only authentication migration", () => {
  it("preserves existing values, IDs, ownership, and counts without granting legacy credentials", async () => {
    const db = new PGlite();
    try {
      await db.exec(await migration("0001_init.sql"));
      await db.exec(`INSERT INTO "User" (id,email,name,"updatedAt") VALUES ('legacy','Legacy@Example.com',NULL,'2025-01-02');
        INSERT INTO "Win" (id,reflection,category,latitude,longitude,"updatedAt","userId") VALUES ('win','Keep this','FITNESS',1,2,'2025-01-03','legacy')`);
      const users = await db.query(`SELECT id,email,name,"createdAt","updatedAt" FROM "User"`);
      const wins = await db.query(`SELECT * FROM "Win"`);
      await db.exec(await migration("0002_authentication.sql"));
      expect((await db.query(`SELECT id,email,name,"createdAt","updatedAt" FROM "User"`)).rows).toEqual(users.rows);
      expect((await db.query(`SELECT * FROM "Win"`)).rows).toEqual(wins.rows);
      expect((await db.query(`SELECT "emailVerified",image FROM "User"`)).rows).toEqual([{ emailVerified: false, image: null }]);
      expect((await db.query(`SELECT * FROM "Account"`)).rows).toEqual([]);
      expect((await db.query(`SELECT * FROM "Session"`)).rows).toEqual([]);
      await expect(db.exec(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('duplicate','legacy@example.com',CURRENT_TIMESTAMP)`)).rejects.toThrow();
    } finally { await db.close(); }
  }, 30000);

  it("aborts safely on case-folded legacy conflicts rather than merging or deleting users", async () => {
    const db = new PGlite();
    try {
      await db.exec(await migration("0001_init.sql"));
      await db.exec(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('one','Same@example.com',CURRENT_TIMESTAMP),('two','same@example.com',CURRENT_TIMESTAMP)`);
      const before = (await db.query(`SELECT * FROM "User" ORDER BY id`)).rows;
      await expect(db.exec(await migration("0002_authentication.sql"))).rejects.toThrow("case-insensitive email duplicates");
      await db.exec("ROLLBACK");
      expect((await db.query(`SELECT * FROM "User" ORDER BY id`)).rows).toEqual(before);
      expect((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name='emailVerified'`)).rows).toEqual([]);
    } finally { await db.close(); }
  }, 30000);
});
