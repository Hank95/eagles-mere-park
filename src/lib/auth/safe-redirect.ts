/**
 * Validate a post-login redirect target. Only allow same-origin, single-leading-slash
 * paths. Anything else (absolute URLs, protocol-relative URLs, missing slash) falls
 * back to /dashboard. Prevents open-redirect attacks via crafted ?next= values.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";
  return next;
}
