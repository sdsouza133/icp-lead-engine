import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps paths on this site, including query strings", () => {
    expect(safeNextPath("/app/123?tab=members")).toBe("/app/123?tab=members");
    expect(safeNextPath("/invite/abc")).toBe("/invite/abc");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "app",
    "",
    null,
    undefined,
    42,
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value)).toBe("/app");
  });

  it("uses the fallback it is given", () => {
    expect(safeNextPath("https://evil.example", "/")).toBe("/");
  });
});
