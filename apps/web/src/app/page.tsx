import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">ICP Lead Engine</h1>
      <p className="text-neutral-600">
        ICP-qualified leads from the people engaging with your competitors on LinkedIn.
      </p>
      <div>
        <Link
          href="/app"
          className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Go to your workspaces
        </Link>
      </div>
    </main>
  );
}
