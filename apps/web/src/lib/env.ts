import { z } from "zod";

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/** Read at request time, so the app builds without Supabase settings. */
export function supabaseEnv() {
  // NEXT_PUBLIC_ variables must be referenced literally so Next.js can inline them.
  const env = supabaseEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * The app's public origin, used for links in emails and OAuth redirects. Never derived from the
 * request's Host header, which a client controls.
 */
export function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return "http://localhost:3000";
}
