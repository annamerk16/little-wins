import { z } from "zod";

export const MAX_WIN_PHOTO_BYTES = 5 * 1024 * 1024;

export const WinPhoto = z.custom<File>((value) => value instanceof File, "Select a photo.")
  .refine((file) => file.size > 0, "The photo is empty.")
  .refine((file) => file.size <= MAX_WIN_PHOTO_BYTES, "Choose a photo up to 5 MiB.");

export function winPhotoFormat(data: ArrayBuffer) {
  const bytes = Buffer.from(data);
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", contentType: "image/png" };
  }
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}
