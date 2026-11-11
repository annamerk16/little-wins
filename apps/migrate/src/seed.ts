import { prisma } from "@project/db";
import { seedDemoData } from "./seed-data";

async function main() {
  await seedDemoData(prisma);
  console.log("seed: demo-user and four sample wins are ready (existing rows preserved)");
}

main()
  .catch((err) => {
    console.error("seed: failed; is the local database running?", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
