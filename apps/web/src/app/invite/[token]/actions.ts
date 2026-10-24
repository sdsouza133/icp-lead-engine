"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient, currentUser } from "@/lib/supabase/server";

const invitationToken = z.string().regex(/^[0-9a-f]{64}$/);

export async function acceptInvitation(formData: FormData): Promise<void> {
  const token = invitationToken.safeParse(formData.get("token"));
  if (!token.success) redirect("/app");

  // The proxy signs visitors in first; this covers a session that ends mid-request, which the
  // database would otherwise report the same way as an email mismatch.
  if (!(await currentUser())) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token.data}`)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error || !data) {
    redirect(`/invite/${token.data}?error=${error?.code === "42501" ? "email" : "invalid"}`);
  }

  redirect(`/app/${data.org_id}`);
}
