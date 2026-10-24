import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/app" className="font-semibold tracking-tight">
            ICP Lead Engine
          </Link>
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            <span>{user.email}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="hover:text-neutral-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
