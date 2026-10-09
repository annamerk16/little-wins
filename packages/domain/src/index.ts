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
export const CreateWin = z.object({
  reflection: z.string().trim().min(1, "Reflection is required").max(500, "Keep it under 500 characters"),
  category: categorySchema,
  latitude: z.number(),
  longitude: z.number(),
  photoUrl: z.string().url().optional(),
});

export type CreateWinInput = z.infer<typeof CreateWin>;

export async function createWin(input: { userId: string } & CreateWinInput) {
  return prisma.win.create({
    data: {
      userId: input.userId,
      reflection: input.reflection,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
      photoUrl: input.photoUrl,
    },
  });
}
