import { safeNextPath } from "@icp/core";
import { type NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Finishes Google sign-in and email sign-in links by exchanging the PKCE code for a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, siteUrl()));
  }

  return NextResponse.redirect(new URL("/login?error=link", siteUrl()));
}
