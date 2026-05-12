"use server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-redirect";
import { redirect } from "next/navigation";

export type AuthFormState = { error?: string } | undefined;

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // signOut still clears the local cookie even on a server-side failure,
    // so we redirect the user to / regardless. Log so an outage is observable.
    console.error("signOut error:", error.message);
  }
  redirect("/");
}
