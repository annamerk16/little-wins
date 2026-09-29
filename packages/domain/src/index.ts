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
