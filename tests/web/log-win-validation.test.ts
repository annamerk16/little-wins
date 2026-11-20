import { describe, expect, it } from "vitest";
import {
  GENERIC_SAVE_ERROR,
  errorMessageFor,
  firstInvalidField,
  validateDraft,
  type LogWinDraft,
} from "../../apps/web/components/logWinValidation";

const valid: LogWinDraft = {
  reflection: "Finished my first 5k!",
  category: "FITNESS",
  location: { latitude: 1, longitude: 2 },
};

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(valid)).toEqual({});
  });

  it("rejects empty and whitespace-only reflections", () => {
    expect(validateDraft({ ...valid, reflection: "" }).reflection).toBe("Add a reflection");
    expect(validateDraft({ ...valid, reflection: "   \n " }).reflection).toBe("Add a reflection");
  });

  it("accepts exactly 500 characters and rejects 501", () => {
    expect(validateDraft({ ...valid, reflection: "a".repeat(500) })).toEqual({});
    expect(validateDraft({ ...valid, reflection: "a".repeat(501) }).reflection).toBe(
      "Keep it to 500 characters",
    );
  });

  it("measures the limit after trimming", () => {
    expect(validateDraft({ ...valid, reflection: `  ${"a".repeat(500)}  ` })).toEqual({});
  });

  it("requires a category and a location", () => {
    const errors = validateDraft({ ...valid, category: "", location: null });
    expect(errors.category).toBe("Pick a category");
    expect(errors.location).toBe("Add your location");
  });
});

describe("firstInvalidField", () => {
  it("returns null when there are no errors", () => {
    expect(firstInvalidField({})).toBeNull();
  });

  it("returns fields in form order", () => {
    expect(firstInvalidField({ location: "x", category: "y" })).toBe("category");
    expect(firstInvalidField({ location: "x", reflection: "z" })).toBe("reflection");
  });
});

describe("errorMessageFor", () => {
  it("shows the server message on 400", () => {
    const body = { error: { code: "VALIDATION", message: "Reflection is required" } };
    expect(errorMessageFor(400, body)).toBe("Reflection is required");
  });

  it("falls back to the generic message when a 400 has no usable body", () => {
    expect(errorMessageFor(400, null)).toBe(GENERIC_SAVE_ERROR);
    expect(errorMessageFor(400, { error: {} })).toBe(GENERIC_SAVE_ERROR);
  });

  it("maps 401 to a sign-in message", () => {
    expect(errorMessageFor(401, { error: { message: "Sign in required" } })).toBe(
      "Please sign in to log a win.",
    );
  });

  it("never leaks the body for 500 or network failure", () => {
    expect(errorMessageFor(500, { error: { message: "prisma exploded" } })).toBe(GENERIC_SAVE_ERROR);
    expect(errorMessageFor(null, null)).toBe(GENERIC_SAVE_ERROR);
  });
});
