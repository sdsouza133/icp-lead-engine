import { firstParam, type SearchParams } from "@/lib/search-params";
import { signInWithEmail, signInWithGoogle } from "./actions";

// Fixed messages keyed by code, so nothing from the URL is ever shown as text.
const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  send: "We couldn't send the sign-in link. Try again in a minute.",
  google: "Google sign-in isn't available right now.",
  link: "That sign-in link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = firstParam(params.next) ?? "/app";
  const error = ERRORS[firstParam(params.error) ?? ""];
  const sent = firstParam(params.sent) === "1";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-neutral-600">Use your work email or your Google account.</p>
      </div>

      {sent ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Check your inbox for a sign-in link.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form action={signInWithEmail} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Work email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Email me a sign-in link
        </button>
      </form>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Continue with Google
        </button>
      </form>
    </main>
  );
}
