import { safeNextPath } from "@icp/core";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_OTP_TYPES.has(value);
}

/**
 * Verifies email links that carry a token hash. These work even when the link is opened in a
 * different browser from the one that asked for it. The Supabase email templates must point here.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, siteUrl()));
  }

  return NextResponse.redirect(new URL("/login?error=link", siteUrl()));
}
