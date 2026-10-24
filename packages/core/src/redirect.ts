// Rejects anything a browser could resolve to another site: absolute URLs, protocol-relative
// paths, backslashes, and whitespace or control characters (browsers strip those, which turns
// "/\t/evil.example" into "//evil.example").
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const UNSAFE_CHARACTERS = /[\s\\\u0000-\u001f\u007f]/;

/**
 * Returns `value` when it is a path on this site, otherwise `fallback`. Used for `?next=`
 * parameters so sign-in links cannot send people to another site.
 */
export function safeNextPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (UNSAFE_CHARACTERS.test(value)) return fallback;
  return value;
}
