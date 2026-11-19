import { describe, expect, it } from "vitest";
import { LoginInput, RegisterInput } from "../src/auth-input";

describe("authentication input", () => {
  it("normalizes email while preserving every password character", () => {
    expect(RegisterInput.parse({ email: "  Owner@Example.COM  ", password: "  a password  " }))
      .toEqual({ email: "owner@example.com", password: "  a password  " });
  });
  it("enforces password boundaries", () => {
    for (const [length, valid] of [[11, false], [12, true], [128, true], [129, false]] as const) {
      expect(RegisterInput.safeParse({ email: "owner@example.com", password: "a".repeat(length) }).success).toBe(valid);
    }
  });
  it("rejects invalid email and client-supplied identity fields", () => {
    expect(RegisterInput.safeParse({ email: "not-an-email", password: "long-password" }).success).toBe(false);
    expect(RegisterInput.safeParse({ email: "a@example.com", password: "long-password", userId: "someone-else" }).success).toBe(false);
    expect(LoginInput.safeParse({ email: "a@example.com", password: "x", name: "spoof" }).success).toBe(false);
  });
});
