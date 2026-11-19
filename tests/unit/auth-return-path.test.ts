import { describe, expect, it } from "vitest";
import { safeReturnPath } from "../../packages/auth/src/config";

describe("authentication return paths", () => {
  it("preserves every private screen, including the sidebar routes", () => {
    for (const path of ["/", "/timeline", "/map", "/recap", "/profile", "/sandbox/timeline", "/sandbox/category-filter", "/sandbox/delete-confirm"]) {
      expect(safeReturnPath(path)).toBe(path);
    }
  });

  it("rejects external, ambiguous, public, and unknown destinations", () => {
    for (const path of [undefined, null, {}, "https://example.com/timeline", "//example.com", "/\\example.com", "/timeline?next=//example.com", "/%74imeline", "/login", "/register", "/settings"]) {
      expect(safeReturnPath(path)).toBe("/");
    }
  });
});
