/**
 * Validate a post-login redirect target. Only allow same-origin paths:
 *   - Starts with exactly one `/`
 *   - Second character is not `/` (protocol-relative) or `\` (browsers
 *     normalize `\` to `/` in Location headers, so `/\evil.com` resolves
 *     to `//evil.com` — another protocol-relative bypass)
 * Anything else (absolute URLs, empty, null) falls back to /dashboard.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  if (next === "/") return "/";
  if (!/^\/[^/\\]/.test(next)) return "/dashboard";
  return next;
}
