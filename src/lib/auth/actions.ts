"use server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-redirect";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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

export type ResetRequestState = { sent?: boolean; error?: string } | undefined;

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
  }

  const h = await headers();
  const host = h.get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  // We intentionally do not check for errors here: revealing whether an email
  // exists would let attackers enumerate accounts. Always show "check your email".
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/update-password`,
  });

  return { sent: true };
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
