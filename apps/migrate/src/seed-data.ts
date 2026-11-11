import type { PrismaClient } from "@project/db";

const samples = [
  { id: "demo-win-fitness", category: "FITNESS", reflection: "Sample win: took a walk outside." },
  { id: "demo-win-academic", category: "ACADEMIC", reflection: "Sample win: finished a study session." },
  { id: "demo-win-career", category: "CAREER", reflection: "Sample win: made progress on a project." },
  { id: "demo-win-personal", category: "PERSONAL", reflection: "Sample win: made time for a friend." },
] as const;

export async function seedDemoData(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: "demo-user" },
      update: {},
      create: { id: "demo-user", email: "demo@little-wins.example", name: "Demo User" },
    });
    for (const sample of samples) {
      await tx.win.upsert({
        where: { id: sample.id },
        update: {},
        create: { ...sample, userId: "demo-user", latitude: 0, longitude: 0 },
      });
    }
  });
}
