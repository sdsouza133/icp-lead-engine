"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Row-level security decides who may invite or revoke; these checks only validate the input.
const inviteInput = z.object({
  orgId: z.uuid(),
  email: z.email(),
  role: z.enum(["member", "admin"]),
});

const revokeInput = z.object({
  orgId: z.uuid(),
  invitationId: z.uuid(),
});

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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("invitations").insert({ org_id: orgId, email, role });
  if (error)
    redirect(`/app/${orgId}?error=${error.code === "23505" ? "duplicate" : "invite-failed"}`);

  redirect(`/app/${orgId}`);
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const parsed = revokeInput.safeParse({
    orgId: formData.get("orgId"),
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) redirect("/app");

  const { orgId, invitationId } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId)
    .eq("org_id", orgId);
  if (error) redirect(`/app/${orgId}?error=revoke`);

  redirect(`/app/${orgId}`);
}
