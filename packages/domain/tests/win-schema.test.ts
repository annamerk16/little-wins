import { describe, it, expect } from "vitest";
import { CreateWin } from "../src/index";

describe("CreateWin schema", () => {
  it("accepts a valid win", () => {
    expect(
      CreateWin.safeParse({
        reflection: "Finished my first 5k!",
        category: "FITNESS",
        latitude: 40.7128,
        longitude: -74.006,
      }).success
    ).toBe(true);
  });

  it("rejects an empty reflection", () => {
    expect(
      CreateWin.safeParse({
        reflection: "   ",
        category: "FITNESS",
        latitude: 40.7128,
        longitude: -74.006,
      }).success
    ).toBe(false);
  });

  it("rejects a missing category", () => {
    expect(
      CreateWin.safeParse({
        reflection: "Finished my first 5k!",
        latitude: 40.7128,
        longitude: -74.006,
      }).success
    ).toBe(false);
  });

  it("rejects a wrong type for latitude", () => {
    expect(
      CreateWin.safeParse({
        reflection: "Finished my first 5k!",
        category: "FITNESS",
        latitude: "not-a-number",
        longitude: -74.006,
      }).success
    ).toBe(false);
  });
});