import { Category, prisma } from "@project/db";
import { z } from "zod";

export { RegisterInput, LoginInput, validateAuthInput } from "./auth-input";
export { MAX_WIN_PHOTO_BYTES, WinPhoto, winPhotoFormat } from "./win-photo";

// Authentication-only lookup; never grants access or attaches a credential.
export async function registrationEmailExists(email: string) {
  return (await prisma.user.count({ where: { email: { equals: email, mode: "insensitive" } } })) > 0;
}

export const categorySchema = z.nativeEnum(Category);
export type WinCategory = z.infer<typeof categorySchema>;

function publicWin<T extends { id: string; photoUrl: string | null; photoBlobKey: string | null }>({
  photoBlobKey,
  ...win
}: T) {
  return { ...win, photoUrl: photoBlobKey ? `/api/wins/${encodeURIComponent(win.id)}/photo` : win.photoUrl };
}

export async function listWins(input: {
  userId: string;
  category?: WinCategory;
}) {
  const wins = await prisma.win.findMany({
    where: {
      userId: input.userId,
      ...(input.category === undefined ? {} : { category: input.category }),
    },
    orderBy: { createdAt: "desc" },
  });
  return wins.map(publicWin);
}

export async function getWin(input: { userId: string; id: string }) {
  const win = await prisma.win.findFirst({
    where: { id: input.id, userId: input.userId },
  });
  return win && publicWin(win);
}

export async function getWinPhoto(input: { userId: string; id: string }) {
  return prisma.win.findFirst({
    where: input,
    select: { photoBlobKey: true },
  });
}

export async function attachWinPhoto(input: { userId: string; id: string; photoBlobKey: string }) {
  const result = await prisma.win.updateMany({
    where: { id: input.id, userId: input.userId, photoBlobKey: null },
    data: { photoBlobKey: input.photoBlobKey },
  });
  return result.count === 1;
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
  const win = await prisma.win.create({
    data: {
      userId: input.userId,
      reflection: input.reflection,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
      photoUrl: input.photoUrl,
    },
  });
  return publicWin(win);
}

export async function deleteWin(input: { userId: string; id: string }) {
  const result = await prisma.win.deleteMany({
    where: { id: input.id, userId: input.userId },
  });

  return result.count === 1;
}
