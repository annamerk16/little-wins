import { Category, prisma } from "@project/db";
import { z } from "zod";

export const categorySchema = z.nativeEnum(Category);
export type WinCategory = z.infer<typeof categorySchema>;

export async function listWins(input: {
  userId: string;
  category?: WinCategory;
}) {
  return prisma.win.findMany({
    where: {
      userId: input.userId,
      ...(input.category === undefined ? {} : { category: input.category }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWin(input: { userId: string; id: string }) {
  return prisma.win.findFirst({
    where: { id: input.id, userId: input.userId },
  });
}

export async function deleteWin(input: { userId: string; id: string }) {
  const result = await prisma.win.deleteMany({
    where: { id: input.id, userId: input.userId },
  });

  return result.count === 1;
}
