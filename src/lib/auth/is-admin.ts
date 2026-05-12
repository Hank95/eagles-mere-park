import type { User } from "@supabase/supabase-js";

/**
 * Reads the `is_admin` flag from the user's app_metadata. Set server-side via
 * the service-role API; clients cannot self-elevate. See PLANNING.md §9.
 *
 * `UserAppMetadata` has an `[key: string]: any` index signature, so we can
 * read arbitrary claims on it without casting.
 */
export function isAdmin(user: User): boolean {
  return user.app_metadata?.is_admin === true;
}
