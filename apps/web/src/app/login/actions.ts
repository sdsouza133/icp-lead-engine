"use server";

import { safeNextPath } from "@icp/core";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function callbackUrl(next: string): string {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function loginUrl(next: string, extra: Record<string, string>): string {
  return `/login?${new URLSearchParams({ next, ...extra }).toString()}`;
}

export async function signInWithEmail(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const email = z.email().safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!email.success) redirect(loginUrl(next, { error: "email" }));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  if (error) redirect(loginUrl(next, { error: "send" }));

  redirect(loginUrl(next, { sent: "1" }));
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) redirect(loginUrl(next, { error: "google" }));

  redirect(data.url);
}
