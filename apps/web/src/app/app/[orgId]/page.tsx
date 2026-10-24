import { notFound } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { firstParam, type SearchParams } from "@/lib/search-params";
import { createSupabaseServerClient, currentUser } from "@/lib/supabase/server";
import { inviteMember, revokeInvitation } from "./actions";

const ERRORS: Record<string, string> = {
  invite: "Enter a valid email address and choose a role.",
  duplicate: "That person already has a pending invitation.",
  "invite-failed": "We couldn't create the invitation.",
  revoke: "We couldn't revoke that invitation.",
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: SearchParams;
}) {
  const { orgId } = await params;
  if (!z.uuid().safeParse(orgId).success) notFound();

  const error = ERRORS[firstParam((await searchParams).error) ?? ""];
  const user = await currentUser();
  const supabase = await createSupabaseServerClient();

  // Row-level security returns nothing for a workspace this user cannot read.
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org || !user) notFound();

  const { data: members } = await supabase.rpc("workspace_members", { p_org_id: orgId });
  const myRole = members?.find((member) => member.user_id === user.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const { data: invitations } = canManage
    ? await supabase
        .from("invitations")
        .select("id, email, role, token, expires_at")
        .eq("org_id", orgId)
        .is("accepted_at", null)
        .order("created_at")
    : { data: null };

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-sm text-neutral-600">
          {myRole ? `Your role: ${myRole}` : "You're viewing this workspace with staff access."}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500">
            <tr>
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Role</th>
              <th className="py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(members ?? []).map((member) => (
              <tr key={member.user_id}>
                <td className="py-2">{member.email}</td>
                <td className="py-2">{member.role}</td>
                <td className="py-2">{dateFormat.format(new Date(member.joined_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canManage ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Invite someone</h2>
          <form action={inviteMember} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="orgId" value={org.id} />
            <label className="block space-y-1">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                className="w-64 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Role</span>
              <select
                name="role"
                defaultValue="member"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Create invitation
            </button>
          </form>

          {invitations && invitations.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pending invitations</h3>
              <p className="text-sm text-neutral-600">
                Send each person their link. It works only for the invited email and expires after 7
                days.
              </p>
              <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {invitation.email} · {invitation.role} · expires{" "}
                        {dateFormat.format(new Date(invitation.expires_at))}
                      </span>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="orgId" value={org.id} />
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <button type="submit" className="text-red-700 hover:underline">
                          Revoke
                        </button>
                      </form>
                    </div>
                    <input
                      readOnly
                      aria-label={`Invitation link for ${invitation.email}`}
                      value={`${siteUrl()}/invite/${invitation.token}`}
                      className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
