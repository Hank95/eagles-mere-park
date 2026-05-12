import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * On a signed-in request, ensure the auth user is linked to their pre-seeded
 * `members` row. Runs from the authed layout on every request — fast-paths
 * out if already linked. Silent: never throws, never prompts.
 *
 * Linking rule: match `members.email` (lowercase) to `auth.users.email`, only
 * when `members.user_id IS NULL` (so a hostile actor who knows an invited
 * email cannot steal an already-claimed row). The RLS policies and the
 * service-role insert in `invite-member.ts` ensure pre-seeded rows have an
 * email but no `user_id`.
 */
export async function claimMemberRowIfNeeded(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<void> {
  // Fast path: already linked.
  const { data: own } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (own) return;

  // OAuth users without an email can never be auto-linked.
  if (!user.email) return;

  // Slow path: look for a pre-seeded unlinked row matching this email.
  const { data: match } = await supabase
    .from("members")
    .select("id")
    .ilike("email", user.email)
    .is("user_id", null)
    .maybeSingle();
  if (!match) return;

  await supabase.from("members").update({ user_id: user.id }).eq("id", match.id);
}
