import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");
const password = z.string().min(12, "Use at least 12 characters").max(128, "Use at most 128 characters");

export const RegisterInput = z.object({ email, password }).strict();
// Login accepts older short passwords to preserve generic invalid-credential errors.
export const LoginInput = z.object({ email, password: z.string().min(1).max(128) }).strict();

export function validateAuthInput(path: string, body: unknown) {
  return (path === "/sign-up/email" ? RegisterInput : LoginInput).safeParse(body);
}
