"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const workspaceName = z.string().trim().min(1).max(100);

export async function createWorkspace(formData: FormData): Promise<void> {
  const name = workspaceName.safeParse(formData.get("name"));
  if (!name.success) redirect("/app?error=name");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: name.data });
  if (error || !data) redirect("/app?error=create");

  redirect(`/app/${data.id}`);
}
