import Link from "next/link";
import { redirect } from "next/navigation";
import { firstParam, type SearchParams } from "@/lib/search-params";
import { createSupabaseServerClient, currentUser } from "@/lib/supabase/server";
import { createWorkspace } from "./actions";

const ERRORS: Record<string, string> = {
  name: "Workspace names need 1 to 100 characters.",
  create: "We couldn't create the workspace. Try again.",
};

export default async function WorkspacesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app");

  const error = ERRORS[firstParam((await searchParams).error) ?? ""];
  const supabase = await createSupabaseServerClient();
  const [{ data: organizations }, { data: memberships }] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("memberships").select("org_id, role").eq("user_id", user.id),
  ]);
  const roleByOrg = new Map((memberships ?? []).map((m) => [m.org_id, m.role]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>

      {organizations && organizations.length > 0 ? (
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {organizations.map((org) => (
            <li key={org.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/app/${org.id}`} className="font-medium hover:underline">
                {org.name}
              </Link>
              <span className="text-sm text-neutral-500">
                {roleByOrg.get(org.id) ?? "staff access"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-600">You're not in any workspace yet. Create one below.</p>
      )}

      <form action={createWorkspace} className="max-w-sm space-y-3">
        <h2 className="text-lg font-semibold">Create a workspace</h2>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Workspace name</span>
          <input
            name="name"
            required
            maxLength={100}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Create workspace
        </button>
      </form>
    </div>
  );
}
