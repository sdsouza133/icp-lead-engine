import { redirect } from "next/navigation";
import { firstParam, type SearchParams } from "@/lib/search-params";
import { currentUser } from "@/lib/supabase/server";
import { acceptInvitation } from "./actions";

const ERRORS: Record<string, string> = {
  email:
    "This invitation was sent to a different email address. Sign in with that address to accept it.",
  invalid: "This invitation is no longer valid. Ask the person who invited you for a new one.",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const error = ERRORS[firstParam((await searchParams).error) ?? ""];

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Join a workspace</h1>
        <p className="text-sm text-neutral-600">
          You're signed in as {user.email}. Accept the invitation to join the workspace.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form action={acceptInvitation}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Accept invitation
        </button>
      </form>
    </main>
  );
}
