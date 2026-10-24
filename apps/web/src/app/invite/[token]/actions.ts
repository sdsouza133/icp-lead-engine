"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const invitationToken = z.string().regex(/^[0-9a-f]{64}$/);

export async function acceptInvitation(formData: FormData): Promise<void> {
  const token = invitationToken.safeParse(formData.get("token"));
  if (!token.success) redirect("/app");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error || !data) {
    redirect(`/invite/${token.data}?error=${error?.code === "42501" ? "email" : "invalid"}`);
  }

  redirect(`/app/${data.org_id}`);
}
