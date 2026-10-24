"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient, currentUser } from "@/lib/supabase/server";

const inviteInput = z.object({
  orgId: z.uuid(),
  email: z.email(),
  role: z.enum(["member", "admin"]),
});

const revokeInput = z.object({
  orgId: z.uuid(),
  invitationId: z.uuid(),
});

/**
 * Row-level security is what enforces access. This guard gives callers a clear outcome first:
 * signed-out visitors go to sign-in, and anyone who isn't an owner or admin goes back to the
 * workspace page with an explanation.
 */
async function requireManager(orgId: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/${orgId}`)}`);

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    redirect(`/app/${orgId}?error=forbidden`);
  }

  return supabase;
}

export async function inviteMember(formData: FormData): Promise<void> {
  const parsed = inviteInput.safeParse({
    orgId: formData.get("orgId"),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect(`/app/${encodeURIComponent(String(formData.get("orgId") ?? ""))}?error=invite`);
  }

  const { orgId, email, role } = parsed.data;
  const supabase = await requireManager(orgId);
  const { error } = await supabase.from("invitations").insert({ org_id: orgId, email, role });
  if (error) {
    redirect(`/app/${orgId}?error=${error.code === "23505" ? "duplicate" : "invite-failed"}`);
  }

  redirect(`/app/${orgId}`);
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const parsed = revokeInput.safeParse({
    orgId: formData.get("orgId"),
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) redirect("/app");

  const { orgId, invitationId } = parsed.data;
  const supabase = await requireManager(orgId);
  // A delete that matches no row is not an error to Postgres, so check what was removed.
  const { data: removed, error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId)
    .eq("org_id", orgId)
    .select("id");
  if (error || !removed?.length) redirect(`/app/${orgId}?error=revoke`);

  redirect(`/app/${orgId}`);
}
