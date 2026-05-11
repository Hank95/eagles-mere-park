# Eagles Mere Park — Agent Guide

A members-only community site for Eagles Mere Park. Single tenant. Side project. Maintained by one person.

This file is the canonical agent guide. `CLAUDE.md` points here.

## Required reading

**Before suggesting changes to scope, architecture, data model, or auth: read `PLANNING.md` in full.** It is the source of truth for what we are building and why. The non-goals (§1.3), out-of-scope features (§3.3), and decisions log (§9) are intentional — if a request appears to violate any of them, surface that to the human before building.

When product scope or architectural direction changes, append to `PLANNING.md` §9. Do not edit decisions in place.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Specific Next.js 16 gotchas already biting this project:
- `middleware.ts` is renamed to `proxy.ts`. The named export is `proxy`, not `middleware`. Runtime is `nodejs` only — no edge runtime in `proxy`. Our session-refresh proxy lives at `src/proxy.ts`.
- `cookies()`, `headers()`, `params`, and `searchParams` are strictly async. Always `await` them.
- Turbopack is the default for `next dev` and `next build`.

## Hard scope rules

- **Single tenant.** No multi-tenant abstractions. Hardcoded references to "Eagles Mere Park" are fine. If a future BTR product is mentioned, it is a separate codebase — do not generalize this one for it.
- **No theme system.** Visual identity is fixed.
- **No discussion forums, no real-time chat, no payments, no booking systems, no native mobile, no public-facing member data.** See `PLANNING.md` §3.3.
- **Privacy is the product.** Contact fields default to private. Photo removal is no-questions-asked. Treat any new feature touching member data as privacy-sensitive by default.

## Ratified technical decisions

These have been recorded in `PLANNING.md` §9. Follow them; do not relitigate without a new §9 entry.

- **Stack:** Next.js 16 (App Router, Turbopack) on Vercel, Supabase (Postgres + Auth + Storage), Tailwind v4 + shadcn/ui (Radix primitives, Nova preset), Resend for email.
- **Auth:** Supabase email + password, optional Google. No magic links.
- **Signup is disabled at the auth layer** (`DISABLE_SIGNUP=true` on the Supabase project). Account creation happens only via `admin.inviteUserByEmail` from a server route guarded by the admin JWT claim. Do not introduce a self-signup path, a `pending` column, or any application-level approval gate — the auth layer is the gate.
- **Admin role lives in `auth.users.app_metadata.is_admin`**, set server-side via the service-role API. RLS policies read it from the JWT, e.g. `(auth.jwt()->'app_metadata'->>'is_admin')::boolean`. Do not introduce a `user_roles` table or an `is_admin` column on `members` — joining to a roles table inside RLS is the pattern we explicitly rejected.
- **Map:** custom illustrated SVG embedded in a React component. No Leaflet, no tile maps.
- **No CMS, no permissions framework, no notification system.** Database + RLS + email + in-app feed is enough.

## Supabase client conventions

- `src/lib/supabase/client.ts` — browser client, for Client Components and client-side code.
- `src/lib/supabase/server.ts` — server client, for Server Components, Route Handlers, and Server Actions. The `createClient` export is async (awaits `cookies()`).
- `src/lib/supabase/proxy.ts` — session-refresh helper used by `src/proxy.ts`. Do not put unrelated logic between `createServerClient` and `getUser()` in this file — a stale session there causes sign-out loops.
- Env vars use the new Supabase naming: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `..._ANON_KEY`). `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never leak to client code.

## When to ask before doing

Pause and surface to the human before:

- Adding any dependency not already in `package.json`.
- Introducing an abstraction (interface, adapter, factory) where a concrete implementation would work.
- Writing an RLS policy that joins to another table — confirm a JWT claim can't do the job first.
- Adding a feature, field, or page not described in `PLANNING.md` §3.1 or §3.2.
- Touching anything in `PLANNING.md` §3.3 (explicitly out of scope) — these are deliberate exclusions, not omissions.
- Modifying `PLANNING.md` §9 decisions in place. Append a new entry instead.
- Renaming `proxy.ts` back to `middleware.ts` or switching to edge runtime — Next 16 only supports the proxy convention.

## Code conventions

Detailed conventions (formatting, naming, file layout, test approach) will live in `CONVENTIONS.md` once the codebase grows. Until then: match what is already in the repo, prefer boring over clever, and write the simplest thing that solves the problem in front of you.

## Open questions

`PLANNING.md` §8 lists open product/operational questions that may block work. If you hit one, surface it — do not guess an answer and proceed.
