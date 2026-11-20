// Pure and client-safe: mirrors CreateWin in @project/domain, which cannot be
// imported here because it pulls the Prisma client into the browser bundle.
// The server stays authoritative.

export const CATEGORIES = ["FITNESS", "ACADEMIC", "CAREER", "PERSONAL"] as const;
export type LogWinCategory = (typeof CATEGORIES)[number];

export const MAX_REFLECTION = 500;

export type LogWinDraft = {
  reflection: string;
  category: LogWinCategory | "";
  location: { latitude: number; longitude: number } | null;
};

export type LogWinField = "reflection" | "category" | "location";
export type FieldErrors = Partial<Record<LogWinField, string>>;

const FIELD_ORDER: LogWinField[] = ["reflection", "category", "location"];

export function validateDraft(draft: LogWinDraft): FieldErrors {
  const errors: FieldErrors = {};
  const length = draft.reflection.trim().length;
  if (length === 0) errors.reflection = "Add a reflection";
  else if (length > MAX_REFLECTION) errors.reflection = "Keep it to 500 characters";
  if (draft.category === "") errors.category = "Pick a category";
  if (draft.location === null) errors.location = "Add your location";
  return errors;
}

export function firstInvalidField(errors: FieldErrors): LogWinField | null {
  return FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

export const GENERIC_SAVE_ERROR = "Couldn't save your win. Please try again.";

// status is null for a network failure. Raw error text never reaches the UI
// except the server's own `error.message` on a 400.
export function errorMessageFor(status: number | null, body: unknown): string {
  if (status === 401) return "Please sign in to log a win.";
  if (status === 400) {
    const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return GENERIC_SAVE_ERROR;
}
