import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./env";

function stubSiteEnv(siteUrlValue: string | undefined, railwayDomain?: string) {
  vi.stubEnv("SITE_URL", siteUrlValue);
  vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", railwayDomain);
}

describe("siteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["https://app.example.com", "https://app.example.com"],
    ["https://app.example.com/", "https://app.example.com"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["http://127.0.0.1:3000/", "http://127.0.0.1:3000"],
  ])("uses SITE_URL %j", (value, expected) => {
    stubSiteEnv(value);
    expect(siteUrl()).toBe(expected);
  });

  it.each(["ftp://app.example.com", "javascript:alert(1)", "app.example.com"])(
    "rejects SITE_URL %j",
    (value) => {
      stubSiteEnv(value);
      expect(() => siteUrl()).toThrow();
    },
  );

  it("falls back to the Railway domain over https", () => {
    stubSiteEnv(undefined, "web-production-1234.up.railway.app");
    expect(siteUrl()).toBe("https://web-production-1234.up.railway.app");
  });

  it("falls back to localhost outside production", () => {
    stubSiteEnv(undefined);
    vi.stubEnv("NODE_ENV", "development");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("refuses to guess in production", () => {
    stubSiteEnv(undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => siteUrl()).toThrow(/SITE_URL/);
  });
});
