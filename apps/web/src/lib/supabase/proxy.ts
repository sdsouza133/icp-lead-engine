import type { Database } from "@icp/db";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "../env";

// Pages anyone can open. Everything else needs a signed-in user.
const PUBLIC_PREFIXES = ["/login", "/auth/"];
const CACHE_HEADERS = ["cache-control", "expires", "pragma"];

function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Refreshes the Supabase session on every matched request and sends signed-out visitors to the
 * login page. Pages and server actions still check the user themselves; this is not the only gate.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Validates the token and refreshes an expired session. Keep this directly after creating the
  // client, before any other logic.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    for (const key of CACHE_HEADERS) {
      const value = response.headers.get(key);
      if (value) redirect.headers.set(key, value);
    }
    return redirect;
  }

  return response;
}
