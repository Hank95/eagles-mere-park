# Phase 1: Auth & member shell — design

**Status:** approved 2026-05-11
**Phase:** 1 of 7 (see `PLANNING.md` §6)
**Depends on:** Phase 0 (scaffold + initial schema migration `20260511230231_initial_schema.sql`)

## Summary

Phase 1 makes the application *enterable*: a member can sign in, reach a stub welcome page behind auth, sign out, and recover their password. It also adds two CLI scripts (`promote-admin`, `invite-member`) so the maintainer can stand up admin accounts and pre-seed the directory before any admin UI exists.

There is no member-facing functionality beyond authentication. The directory, events, map, photos, and documents are all later phases. This phase exists to make every later phase possible.

## Scope

### In scope

- `/login` — email + password sign-in
- `/reset-password` — request a recovery email
- `/update-password` — set a new password after clicking the recovery link
- `/dashboard` — single welcome page behind auth, with sign-out
- Authed route group with a layout-level auth check that redirects to `/login`
- Public route group with the landing page and the auth-related pages
- `scripts/promote-admin.ts` — set `app_metadata.is_admin = true` for an email; creates the user with a temporary password if they don't exist
- `scripts/invite-member.ts` — create (or look up) a household, insert a `members` row, send a Supabase invite email

### Out of scope (and where it goes)

| Out | Where instead |
|---|---|
| Admin invite UI | Phase 2, alongside the directory's "create household" form |
| Member self-edit / profile editing | Phase 2 (directory) |
| Google OAuth | Phase 1.5 or later — `PLANNING.md` §3.1 says optional |
| Member `user_id` linkage on invite acceptance | Phase 2 — Phase 1 sends invites but doesn't auto-link `members.user_id` |
| `/signup` page (dev or prod) | Never built. Account creation is via Supabase dashboard (one-time) or `invite-member.ts`. Matches the production posture in `PLANNING.md` §9 |
| Test suite | Skipped for Phase 1; manual verification per the test plan below |
| Email templating (Resend-hosted) | Phase 6. Supabase's default sender is fine for dev |
| Nav links | Nav is empty in Phase 1 (no destinations). Phase 2 adds the first link |

## Design decisions (Phase-1-specific)

These supplement `PLANNING.md` §9. If any of these prove wrong during implementation, append to §9 — don't edit this file.

- **D1. Auth check lives in the authed-route-group layout, not the proxy.** The layout runs server-side on every request to a gated page; `auth.getUser()` returns current session state with no race against proxy refresh. The proxy continues to do session-token refresh only. Defense in depth: proxy keeps the session valid, layout enforces sign-in, individual pages can layer admin checks (e.g., `is_admin()` on settings pages later).
- **D2. Route groups for public vs. authed.** `app/(public)/...` and `app/(authed)/...`. Route groups don't appear in URLs. Every file under `(authed)` is gated by one layout — adding a new authed page can't accidentally skip the check.
- **D3. CLI scripts for admin-only operations rather than dashboard SQL or env-var allowlists.** Reproducible, git-tracked, same in dev and prod. Bootstrap and invite are both rare operations (≤20×/year), so terminal UX is acceptable.
- **D4. No `/signup` page.** Removes a dev/prod divergence. Account creation in dev: Supabase dashboard or `invite-member.ts`. In prod: `invite-member.ts` (and eventually the Phase 2 UI).
- **D5. `members.user_id` stays null on invite.** Linkage happens on invite acceptance in Phase 2. Phase 1 stores `members.email`, which is what makes Phase 2's "match this invite acceptance to that pre-seeded member row" trivially possible.
- **D6. Recovery-link landing redirects on failure rather than rendering an error page.** Expired or invalid recovery codes bounce to `/reset-password?error=invalid_link`. Keeps `/update-password` focused on a single happy path.

## File structure

```
src/
  app/
    layout.tsx                            # root: html/body, fonts (unchanged)
    (public)/
      layout.tsx                          # minimal public chrome (optional, only if needed)
      page.tsx                            # landing (current src/app/page.tsx moves here)
      login/page.tsx                      # email + password form
      reset-password/page.tsx             # email input
      update-password/page.tsx            # set new password after recovery link
    (authed)/
      layout.tsx                          # auth check + redirect, renders AuthedShell
      dashboard/page.tsx                  # welcome message + sign-out
  components/
    auth/
      login-form.tsx                      # client component (form state, error display)
      reset-request-form.tsx
      update-password-form.tsx
      sign-out-button.tsx
    layout/
      authed-shell.tsx                    # header + user menu + main + footer
  lib/
    supabase/                             # unchanged from Phase 0
    auth/
      actions.ts                          # 'use server' — signIn, signOut, requestReset, updatePassword
  proxy.ts                                # unchanged — session refresh only
scripts/
  promote-admin.ts
  invite-member.ts
```

Notes:
- The existing `src/app/page.tsx` (placeholder landing) moves to `src/app/(public)/page.tsx`. The root `src/app/layout.tsx` stays.
- `(public)/layout.tsx` is optional — if the only public chrome is the same as the root layout, we omit it.
- Form components are client components (need React state for the form), but the submit handlers are Server Actions defined in `src/lib/auth/actions.ts`. The form imports the action and passes it to `<form action={action}>`.

## Auth flows

| Flow | Page | Mechanism |
|---|---|---|
| **Sign in** | `/login` | Server Action calls `supabase.auth.signInWithPassword`. On success, `redirect('/dashboard')` (or `?next=` target if present). On failure, returns `{ error }` to the form. |
| **Sign out** | (any authed page) | Server Action calls `supabase.auth.signOut`, then `redirect('/')`. |
| **Password reset (request)** | `/reset-password` | Server Action calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/update-password\` })`. Always shows a "check your email" message — does not reveal whether the email exists (account enumeration prevention). |
| **Password reset (set new)** | `/update-password` | Page reads the recovery `code` from search params, exchanges it for a session via `supabase.auth.exchangeCodeForSession`. If exchange fails: `redirect('/reset-password?error=invalid_link')`. If it succeeds: render a form. Form's Server Action calls `supabase.auth.updateUser({ password })` and `redirect('/dashboard')`. |
| **Unauthed access to a gated page** | (authed layout intercept) | Layout's auth check runs `auth.getUser()`. If no user: `redirect('/login?next=<original-path>')`. The login form picks up `next` and redirects there post-sign-in. |
| **Authed user hits `/login`** | `/login` page | Page-level check: if user is already signed in, `redirect('/dashboard')`. |

## Layout shells

**Public layout:** the landing page renders full-bleed. Auth pages render a centered card on a neutral background. No nav.

**Authed shell** (`src/components/layout/authed-shell.tsx`):
- Header: "Eagles Mere Park" wordmark left, user menu right (displays `user.email`, dropdown with "Sign out").
- Main: full-width container, max-width applied per page.
- Footer: slim, with a copyright line and (eventually) policy links.
- No nav links in Phase 1.

## Scripts

Both scripts:
- Are TypeScript files run via `pnpm tsx scripts/<file>.ts <args>`.
- Read `.env.local` directly (using `dotenv/config` or `node --env-file=.env.local`).
- Use `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` (not the publishable key).
- Print clear success/error output to stderr; print structured result (JSON) to stdout when useful.
- Exit non-zero on error.

### `scripts/promote-admin.ts <email>`

1. Look up the auth user by email (`auth.admin.listUsers` filtered by email).
2. If not found, create the user via `auth.admin.createUser({ email, password: <random>, email_confirm: true })`. Print: "Created user with temporary password — they should use password reset to set their own."
3. Update the user via `auth.admin.updateUserById(id, { app_metadata: { ...existing, is_admin: true } })`. Preserve existing `app_metadata` fields.
4. Print confirmation with the user id and the resulting `app_metadata`.
5. Idempotent — re-running on an existing admin is a no-op.

### `scripts/invite-member.ts <email> [...flags]`

Flags:
- `--name "Jim Smith"` — required, used for the `members.name` field.
- `--household-id <uuid>` OR `--new-household "The Pines"` (with optional `--street "12 Lake Rd"`) — one is required.
- `--role <text>` — optional (e.g., "year-round", "summer", "extended family").

Sequence:
1. If `--new-household`, insert a new `households` row. Otherwise look up the household by id and fail if missing.
2. Insert a `members` row with `household_id`, `name`, `email`, optional `role`. `user_id` stays null.
3. Call `auth.admin.inviteUserByEmail(email, { redirectTo: \`${appUrl}/update-password\` })`. Supabase sends the invite email.
4. Print the household id, member id, and invite status.
5. Not idempotent — re-running with the same email errors at the invite step (Supabase enforces). Future-us may add `--resend` for re-sending; not Phase 1.

## Dev bootstrap path (one-time after Phase 1 lands)

1. `pnpm tsx scripts/promote-admin.ts <your-email>` → creates the user with a random temp password and sets `is_admin = true`. Script prints next steps.
2. Go to `/reset-password`, enter your email, click the link in the email, set a real password. You are now signed in as an admin.
3. `pnpm tsx scripts/invite-member.ts <friend-email> --name "Test User" --new-household "Test Cottage" --street "1 Test Rd"` → second account, linked to a household, ready to claim in Phase 2.

## Error handling

- Auth form errors (invalid credentials, network failure, Supabase outage) surface as form-level error text below the submit button. No toast library.
- Account enumeration: `/reset-password` always shows "check your email," regardless of whether the email exists.
- Recovery link failures: `/update-password` redirects to `/reset-password?error=invalid_link` with a banner explaining "this link expired or was already used."
- Authed layout redirect carries `?next=<path>` so post-login bounces back to where the user was trying to go. **The login action must validate `next` is a same-origin path** (starts with `/`, no `//`, no scheme) before redirecting — otherwise it's an open-redirect vulnerability. Invalid `next` values fall back to `/dashboard`.
- The proxy already handles session expiry (per `src/lib/supabase/proxy.ts`). No changes there.

## Testing (manual verification)

- [ ] Sign in with valid credentials → lands on `/dashboard`
- [ ] Sign in with invalid credentials → form shows error, stays on `/login`
- [ ] Sign out from `/dashboard` → lands on `/` (landing)
- [ ] Hit `/dashboard` while signed out → redirects to `/login?next=/dashboard`
- [ ] Sign in from that redirect → lands on `/dashboard` (next honored)
- [ ] Hit `/login` while signed in → redirects to `/dashboard`
- [ ] Request password reset for an existing email → email arrives, link works, `/update-password` form lets you set a new password, you're signed in afterward
- [ ] Request password reset for a nonexistent email → still shows "check your email" (no enumeration)
- [ ] Click an expired reset link → bounces to `/reset-password?error=invalid_link`
- [ ] `promote-admin.ts` on a new email → creates user + sets admin
- [ ] `promote-admin.ts` on an existing user → updates `is_admin`, leaves other `app_metadata` intact
- [ ] `promote-admin.ts` on an already-admin → no-op, prints confirmation
- [ ] `invite-member.ts` with `--new-household` → household created, member inserted, invite email arrives
- [ ] `invite-member.ts` with `--household-id <bad>` → errors before sending invite

## Build sequence (suggested implementation order)

This ordering minimizes throwaway work and gives a working flow at each checkpoint.

1. **Move existing landing page into `(public)/` and add the empty `(authed)/layout.tsx` with auth check.** Build still passes. `/dashboard` doesn't exist yet but `(authed)` route group is wired.
2. **Add `/dashboard` stub page.** Hitting `/dashboard` while signed out now redirects to `/login` (which 404s — that's fine, we're about to build it).
3. **Build `/login` page + Server Action.** Sign-in works end-to-end. Test with a manually-created Supabase user.
4. **Add sign-out to the authed shell.**
5. **Build `/reset-password` and `/update-password`.** Test the full recovery loop.
6. **Build `scripts/promote-admin.ts`.** Verify by promoting the manual test user.
7. **Build `scripts/invite-member.ts`.** Verify the full invite → claim email → set password loop.
8. **Polish: layout chrome, error messages, the `?next=` bounce.**

## Open items deferred to later phases

- Member `user_id` linkage during invite acceptance (Phase 2)
- Admin invite UI (Phase 2)
- Member profile self-edit (Phase 2)
- Google OAuth (later)
- Audit log entries for admin actions like promote/invite (later, when `audit_log` table is added)
- Resend-hosted email templates (Phase 6)
