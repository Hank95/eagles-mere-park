# Phase 1: Auth & Member Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app *enterable* — sign in, see a stub welcome page behind auth, sign out, recover password. Two CLI scripts let the maintainer stand up admins and pre-seed members before any admin UI exists.

**Architecture:** Next.js 16 App Router with two route groups (`(public)` and `(authed)`). The `(authed)` layout runs `auth.getUser()` server-side and `redirect()`s to `/login` if there's no session. Auth state-changes go through Server Actions in `src/lib/auth/actions.ts` calling `@supabase/ssr`'s server client. CLI scripts use the service-role key via `@supabase/supabase-js`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, `@supabase/ssr`, `@supabase/supabase-js`, `tsx` (for running TS scripts), `node:util.parseArgs` (for CLI flag parsing).

**Reference spec:** `docs/superpowers/specs/2026-05-11-phase-1-auth-and-member-shell-design.md`.

**Project rules:** Before touching code, read `AGENTS.md` and `PLANNING.md`. The §9 decisions on admin-role-in-JWT and signup-gated-at-auth-layer constrain everything in this plan.

**Testing convention for Phase 1:** No test suite. Each task has a "Manual verification" section with concrete steps. If a step fails, debug before continuing.

---

## Pre-flight

Before starting any task, verify:

- [ ] On `main`, no uncommitted changes (`git status` is clean)
- [ ] `pnpm build` and `pnpm lint` pass (Phase 0 baseline)
- [ ] `.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `supabase migration list` shows `20260511230231_initial_schema` is applied locally and remotely

If any of these fail, stop and resolve before starting Task 1.

---

## Task 1: Route group restructure + authed layout with auth gate

**Files:**
- Move: `src/app/page.tsx` → `src/app/(public)/page.tsx`
- Create: `src/app/(authed)/layout.tsx`

The route groups don't appear in URLs — `(public)` and `(authed)` are organizational. After this task, `/` still renders the landing page; any future page under `(authed)` is gated.

- [ ] **Step 1: Move the landing page into `(public)`**

```bash
mkdir -p src/app/\(public\)
git mv src/app/page.tsx src/app/\(public\)/page.tsx
```

- [ ] **Step 2: Create the authed layout with the session check**

Create `src/app/(authed)/layout.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Verify the build still passes**

Run: `pnpm build`
Expected: build succeeds, route table shows `/` as static.

- [ ] **Step 4: Manual verification**

```bash
pnpm dev
```

- Visit `http://localhost:3000/` — the landing page renders unchanged.
- Visit `http://localhost:3000/dashboard` — Next.js returns a 404 (page doesn't exist yet). That's expected. We're verifying the move didn't break the public route; gated routes come next.

Stop the dev server (`ctrl-c`).

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "Restructure app routes into (public) and (authed) groups

The (authed) layout runs auth.getUser() server-side and redirects to /login
if there's no session. Every file added under (authed) inherits this gate."
```

---

## Task 2: `/dashboard` stub page

**Files:**
- Create: `src/app/(authed)/dashboard/page.tsx`

The stub is intentionally minimal per the spec — a welcome message and nothing else. Sign-out button comes in Task 4 once the action exists.

- [ ] **Step 1: Create the dashboard page**

Create `src/app/(authed)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Eagles Mere Park — Members
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Welcome
        </h1>
        <p className="text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          Directory, events, map, photos, and documents are on the way.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm build`
Expected: build succeeds; `/dashboard` appears in the route table as `ƒ` (dynamic, because the layout reads cookies via `createClient`).

- [ ] **Step 3: Manual verification**

```bash
pnpm dev
```

- Visit `http://localhost:3000/dashboard` — should redirect to `/login` (which 404s — fine, we build it next).

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authed\)/dashboard/page.tsx
git commit -m "Add /dashboard stub welcome page

Behind the (authed) layout's auth gate. Renders a welcome message and
nothing else; the surrounding shell (header, sign-out) lands in Task 4."
```

---

## Task 3: `/login` page + `signIn` Server Action

**Files:**
- Create: `src/lib/auth/safe-redirect.ts`
- Create: `src/lib/auth/actions.ts`
- Create: `src/components/auth/login-form.tsx`
- Create: `src/app/(public)/login/page.tsx`

This is the largest task in the plan. After this, signing in works end-to-end (assuming a user exists; we'll create one manually for verification, then automate it in Task 7).

- [ ] **Step 1: Create the `safeNext` helper**

Create `src/lib/auth/safe-redirect.ts`:

```ts
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
```

- [ ] **Step 2: Quick console check of `safeNext`**

```bash
pnpm tsx -e 'import { safeNext } from "./src/lib/auth/safe-redirect"; console.log({a: safeNext("/foo"), b: safeNext("//evil.com"), c: safeNext("https://evil.com"), d: safeNext(null), e: safeNext("")})'
```

If `tsx` is not yet installed, skip this step — Task 7 adds it; the function is simple enough to eyeball.

Expected: `{ a: '/foo', b: '/dashboard', c: '/dashboard', d: '/dashboard', e: '/dashboard' }`

- [ ] **Step 3: Create the `signIn` Server Action**

Create `src/lib/auth/actions.ts`:

```ts
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
```

Note: `redirect()` throws — it never returns. The `Promise<AuthFormState>` return type is for the error branch only.

- [ ] **Step 4: Create the login form (client component)**

Create `src/components/auth/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signIn,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <a href="/reset-password" className="underline underline-offset-2">
          Forgot your password?
        </a>
      </p>
    </form>
  );
}
```

- [ ] **Step 5: Create the login page**

Create `src/app/(public)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-redirect";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(safeNext(next));
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to Eagles Mere Park
          </h1>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
```

Note: Next.js 16 `searchParams` is a `Promise` — must be awaited.

- [ ] **Step 6: Build to verify all types are correct**

Run: `pnpm build`
Expected: build succeeds. New routes in the table: `/login`.

- [ ] **Step 7: Manual verification (requires a test user)**

Before testing, create a test user via the Supabase dashboard:
1. Open `https://supabase.com/dashboard/project/zrwychzxnovvothweubp/auth/users`
2. Click "Add user" → "Create new user"
3. Email: `test@example.com`, password: `test1234`, check "Auto Confirm User"
4. Save

Then:

```bash
pnpm dev
```

- Visit `/dashboard` while signed out → redirects to `/login`.
- Submit form with wrong password → form shows "Invalid email or password."
- Submit form with `test@example.com` / `test1234` → redirects to `/dashboard` and the welcome page renders.
- Visit `/login` while signed in → redirects to `/dashboard` immediately.

Note: `?next=` will be tested in Task 9 polish, after sign-out exists so we can reset state easily.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth src/components/auth src/app/\(public\)/login
git commit -m "Add /login page with signIn Server Action

Pure-function safeNext() validates ?next= is a same-origin path (prevents
open redirect). Login form is a client component using useActionState;
the action runs server-side via @supabase/ssr's createClient. Already-signed-in
visitors to /login bounce to /dashboard."
```

---

## Task 4: Sign-out from the authed shell

**Files:**
- Modify: `src/lib/auth/actions.ts` (add `signOut`)
- Create: `src/components/auth/sign-out-button.tsx`
- Create: `src/components/layout/authed-shell.tsx`
- Modify: `src/app/(authed)/layout.tsx` (wrap children in `AuthedShell`)

- [ ] **Step 1: Add `signOut` to actions.ts**

Append to `src/lib/auth/actions.ts`:

```ts
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Create the sign-out button**

Create `src/components/auth/sign-out-button.tsx`:

```tsx
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
```

This is a Server Component (no `"use client"`) — the form action is a Server Action, no client JS needed for a button that just submits.

- [ ] **Step 3: Create the authed shell**

Create `src/components/layout/authed-shell.tsx`:

```tsx
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AuthedShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a
            href="/dashboard"
            className="text-sm font-semibold tracking-tight"
          >
            Eagles Mere Park
          </a>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-muted-foreground">
          Eagles Mere Park — members only
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Wrap the authed layout in the shell**

Modify `src/app/(authed)/layout.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthedShell } from "@/components/layout/authed-shell";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AuthedShell email={user.email ?? ""}>{children}</AuthedShell>;
}
```

- [ ] **Step 5: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 6: Manual verification**

```bash
pnpm dev
```

- Sign in (per Task 3) → `/dashboard` renders with the header showing your email + "Sign out" button + footer.
- Click "Sign out" → lands on `/` (landing page).
- Visit `/dashboard` again → redirects to `/login`.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/actions.ts src/components src/app/\(authed\)/layout.tsx
git commit -m "Add authed shell with header, footer, and sign-out

Sign-out is a Server Action submitted by an unstyled <form> — no client JS
needed. The shell receives the user email from the layout's already-fetched
user object, avoiding a second auth.getUser() round-trip."
```

---

## Task 5: `/reset-password` (request a reset)

**Files:**
- Modify: `src/lib/auth/actions.ts` (add `requestPasswordReset`)
- Create: `src/components/auth/reset-request-form.tsx`
- Create: `src/app/(public)/reset-password/page.tsx`

- [ ] **Step 1: Add `requestPasswordReset` to actions.ts**

Append to `src/lib/auth/actions.ts`:

```ts
import { headers } from "next/headers";

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
```

If your editor flags `headers` as an existing import, consolidate to a single import line at the top of the file.

- [ ] **Step 2: Create the reset-request form**

Create `src/components/auth/reset-request-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  type ResetRequestState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    undefined,
  );

  if (state?.sent) {
    return (
      <p className="rounded-md border border-input bg-muted px-4 py-3 text-sm">
        If an account exists for that email, a reset link is on its way. Check
        your inbox.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create the reset-password page**

Create `src/app/(public)/reset-password/page.tsx`:

```tsx
import { ResetRequestForm } from "@/components/auth/reset-request-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to set a new
            password.
          </p>
        </div>

        {error === "invalid_link" ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            That reset link is invalid or expired. Request a new one below.
          </p>
        ) : null}

        <ResetRequestForm />

        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="underline underline-offset-2">
            Back to sign in
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build`
Expected: success. `/reset-password` in route table.

- [ ] **Step 5: Manual verification**

```bash
pnpm dev
```

- Visit `/reset-password` → form renders.
- Submit with the test user email (`test@example.com`) → "If an account exists…" message shows.
- Check the email inbox for `test@example.com` (or whatever Supabase's default sender uses in dev — may be a test inbox depending on your dashboard auth settings). The link should arrive but lead to `/update-password?code=...` which doesn't exist yet (Task 6).
- Submit with a nonsense email → same "If an account exists…" message (no enumeration).
- Submit with empty email → form blocked by HTML `required`.
- Visit `/reset-password?error=invalid_link` → red banner appears above the form.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/actions.ts src/components/auth/reset-request-form.tsx src/app/\(public\)/reset-password
git commit -m "Add /reset-password to request a recovery email

Always returns 'check your email' regardless of whether the address exists
(prevents account enumeration). Origin is derived from request headers so
the recovery link works in dev and prod without an extra env var."
```

---

## Task 6: `/update-password` (set a new password via recovery link)

**Files:**
- Modify: `src/lib/auth/actions.ts` (add `updatePassword`)
- Create: `src/components/auth/update-password-form.tsx`
- Create: `src/app/(public)/update-password/page.tsx`

- [ ] **Step 1: Add `updatePassword` to actions.ts**

Append to `src/lib/auth/actions.ts`:

```ts
export type UpdatePasswordState = { error?: string } | undefined;

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
```

- [ ] **Step 2: Create the update-password form**

Create `src/components/auth/update-password-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  updatePassword,
  type UpdatePasswordState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create the update-password page**

Create `src/app/(public)/update-password/page.tsx`:

```tsx
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (!code) {
    redirect("/reset-password?error=invalid_link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect("/reset-password?error=invalid_link");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set a new password
          </h1>
        </div>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Manual verification (full reset round-trip)**

```bash
pnpm dev
```

- Visit `/reset-password`, submit your test user email.
- Open the email, click the link. Should land on `/update-password?code=...` and render the form.
- Submit two non-matching passwords → "Passwords do not match."
- Submit a 5-char password → "Password must be at least 8 characters."
- Submit two matching passwords (≥8 chars) → redirects to `/dashboard` and you're signed in.
- Sign out, sign in again with the new password → works.
- Visit `/update-password` directly (no `?code=`) → redirects to `/reset-password?error=invalid_link`.
- Visit `/update-password?code=garbage` → redirects to `/reset-password?error=invalid_link`.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/actions.ts src/components/auth/update-password-form.tsx src/app/\(public\)/update-password
git commit -m "Add /update-password to set a new password via recovery link

Page exchanges the recovery code for a session before rendering the form;
invalid or expired codes bounce to /reset-password with an error banner.
Server Action enforces 8-char minimum and password-match in addition to
HTML required attributes."
```

---

## Task 7: `scripts/promote-admin.ts` (and `tsx` dev dep)

**Files:**
- Modify: `package.json` (add `tsx` to devDependencies)
- Create: `scripts/promote-admin.ts`

- [ ] **Step 1: Add `tsx` as a dev dependency**

```bash
pnpm add -D tsx
```

Expected: `package.json` and `pnpm-lock.yaml` updated; `tsx` shows in devDependencies.

- [ ] **Step 2: Create the promote-admin script**

Create `scripts/promote-admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Run with: pnpm dotenv -e .env.local -- pnpm tsx scripts/promote-admin.ts <email>\n" +
      "Or export them in your shell.",
  );
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: pnpm tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let createdNew = false;

  if (!user) {
    const tempPassword = `${randomUUID()}-${randomUUID()}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error("Failed to create user:", error?.message);
      process.exit(1);
    }
    user = data.user;
    createdNew = true;
  }

  const existingMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...existingMeta, is_admin: true },
  });

  if (updateError) {
    console.error("Failed to set is_admin:", updateError.message);
    process.exit(1);
  }

  if (createdNew) {
    console.log(
      `Created user ${email} (id: ${user.id}) with a random temp password.\n` +
        `Have them visit /reset-password to set their own password.`,
    );
  }
  console.log(`✓ ${email} is now admin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify env loading works**

The script reads `process.env` directly — Node 23 doesn't auto-load `.env.local`. The cleanest way to run it without adding more deps is Node's built-in `--env-file` flag:

```bash
node --env-file=.env.local --import tsx scripts/promote-admin.ts your-real-email@example.com
```

Expected output:
```
Created user your-real-email@example.com (id: <uuid>) with a random temp password.
Have them visit /reset-password to set their own password.
✓ your-real-email@example.com is now admin.
```

(If the email already exists from earlier verification, you'll see only the "✓ is now admin" line.)

- [ ] **Step 4: Add a package.json shortcut for the script**

Modify `package.json` `scripts`:

```json
"promote-admin": "node --env-file=.env.local --import tsx scripts/promote-admin.ts"
```

Now invoke as: `pnpm promote-admin your-email@example.com`

- [ ] **Step 5: Manual verification — idempotency**

```bash
pnpm promote-admin your-real-email@example.com
```

Run a second time. Expected: only the "✓ is now admin" line (no error). Verifies idempotency.

Then go to `/reset-password` in the browser, request a reset, click the email, set your password, and confirm you can sign in.

To verify the admin claim is in the JWT, sign in as that user in the browser, open browser devtools → Application → Cookies → find the Supabase auth cookie → decode the JWT at https://jwt.io (or `console.log` the user object from the dashboard page). Look for `app_metadata.is_admin: true`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/promote-admin.ts
git commit -m "Add scripts/promote-admin.ts and tsx devDep

Creates the user with a random temp password if they don't exist, then sets
app_metadata.is_admin=true via the service-role API. Idempotent. Run via
'pnpm promote-admin <email>' which loads .env.local via Node's --env-file.

This is the canonical way new admins are bootstrapped in both dev and prod
(see docs/superpowers/specs/2026-05-11-phase-1-auth-and-member-shell-design.md)."
```

---

## Task 8: `scripts/invite-member.ts`

**Files:**
- Create: `scripts/invite-member.ts`
- Modify: `package.json` (add `invite-member` shortcut)

- [ ] **Step 1: Create the invite-member script**

Create `scripts/invite-member.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    name: { type: "string" },
    "household-id": { type: "string" },
    "new-household": { type: "string" },
    street: { type: "string" },
    role: { type: "string" },
  },
  allowPositionals: true,
});

const email = positionals[0];
const name = values.name;
const householdId = values["household-id"];
const newHouseholdName = values["new-household"];
const street = values.street;
const role = values.role;

function usage(msg?: string): never {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    "Usage: pnpm invite-member <email> --name \"Jim Smith\"\n" +
      "         (--household-id <uuid> | --new-household \"The Pines\" [--street \"12 Lake Rd\"])\n" +
      "         [--role \"year-round\"]\n",
  );
  process.exit(1);
}

if (!email) usage("email is required");
if (!name) usage("--name is required");
if (!householdId && !newHouseholdName) {
  usage("either --household-id or --new-household is required");
}
if (householdId && newHouseholdName) {
  usage("pass either --household-id or --new-household, not both");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let resolvedHouseholdId: string;

  if (newHouseholdName) {
    const { data, error } = await supabase
      .from("households")
      .insert({
        cottage_name: newHouseholdName,
        street_address: street ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Failed to create household:", error?.message);
      process.exit(1);
    }
    resolvedHouseholdId = data.id;
    console.log(`Created household '${newHouseholdName}' (id: ${data.id})`);
  } else {
    const { data, error } = await supabase
      .from("households")
      .select("id, cottage_name")
      .eq("id", householdId!)
      .single();
    if (error || !data) {
      console.error(`Household ${householdId} not found.`);
      process.exit(1);
    }
    resolvedHouseholdId = data.id;
    console.log(`Using existing household '${data.cottage_name}' (id: ${data.id})`);
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .insert({
      household_id: resolvedHouseholdId,
      name: name!,
      email,
      role: role ?? null,
    })
    .select("id")
    .single();
  if (memberError || !memberData) {
    console.error("Failed to insert member row:", memberError?.message);
    process.exit(1);
  }
  console.log(`Inserted member ${name} (id: ${memberData.id})`);

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    console.error("Failed to send invite:", inviteError.message);
    console.error(
      "Household and member rows were created. To retry the invite, " +
        "delete the member row and re-run.",
    );
    process.exit(1);
  }
  console.log(`✓ Invite sent to ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note: the `members` insert via service-role bypasses RLS, so this works even though the policy says only admins can insert. The service-role key has no RLS at all by design.

- [ ] **Step 2: Add the package.json shortcut**

Modify `package.json` `scripts`:

```json
"invite-member": "node --env-file=.env.local --import tsx scripts/invite-member.ts"
```

Final `scripts` block should look like:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "types:gen": "supabase gen types typescript --linked 2>/dev/null | grep -Ev '^(Initialising |Connecting |A new version |We recommend )' > src/lib/database.types.ts",
  "promote-admin": "node --env-file=.env.local --import tsx scripts/promote-admin.ts",
  "invite-member": "node --env-file=.env.local --import tsx scripts/invite-member.ts"
}
```

- [ ] **Step 3: Manual verification — usage errors**

```bash
pnpm invite-member
```
Expected: usage error "email is required".

```bash
pnpm invite-member friend@example.com
```
Expected: usage error "--name is required".

```bash
pnpm invite-member friend@example.com --name "Test User"
```
Expected: usage error "either --household-id or --new-household is required".

```bash
pnpm invite-member friend@example.com --name "Test User" --household-id 00000000-0000-0000-0000-000000000000
```
Expected: "Household 00000000-... not found."

- [ ] **Step 4: Manual verification — full happy path**

```bash
pnpm invite-member friend@example.com --name "Test Friend" --new-household "Test Cottage" --street "1 Lake Rd"
```

Expected output:
```
Created household 'Test Cottage' (id: <uuid>)
Inserted member Test Friend (id: <uuid>)
✓ Invite sent to friend@example.com.
```

Check `friend@example.com`'s inbox for the invite. The link goes through Supabase's default flow (set password, then signs in). Once accepted, you have a second non-admin account.

To verify the rows in the DB, in the Supabase dashboard SQL editor:
```sql
select id, cottage_name from public.households order by created_at desc limit 5;
select id, household_id, name, email, user_id from public.members order by created_at desc limit 5;
```

Note: `user_id` will be `null` on the new member row even after the user accepts the invite — Phase 1 doesn't auto-link. Phase 2 adds the claim step.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/invite-member.ts
git commit -m "Add scripts/invite-member.ts

Creates a household (or links to an existing one), inserts a members row,
and sends a Supabase invite email. Not idempotent — re-running on the same
email fails at the invite step (Supabase enforces unique invitations).

members.user_id stays null on invite; Phase 2's claim flow links it when
the recipient accepts."
```

---

## Task 9: Polish — `?next=` bounce, copy edits, dashboard greeting

**Files:**
- Modify: `src/app/(authed)/dashboard/page.tsx` (greet by name if member row found)
- Modify: `src/app/(authed)/layout.tsx` (pass user along, set `?next=` on redirect)

The auth gate currently does `redirect("/login")` without `?next=`. This task adds the bounce-back so a deep link to `/dashboard/anything-future` lands the user back where they came from after sign-in.

- [ ] **Step 1: Capture the current path in the layout's redirect**

The layout doesn't have direct access to the current URL — it only renders. But we can use `headers()` to read the `x-invoke-path` or `referer`, or use middleware/proxy. The cleanest path in Next 16 is via `next/headers`:

Modify `src/app/(authed)/layout.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthedShell } from "@/components/layout/authed-shell";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Use the standard Next.js header that carries the current path through
    // server-side rendering. Fall back to /dashboard if absent.
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return <AuthedShell email={user.email ?? ""}>{children}</AuthedShell>;
}
```

Note: `x-pathname` is not a Next-set header by default. We'll set it in the proxy.

- [ ] **Step 2: Forward `x-pathname` to Server Components via the proxy helper**

Mutating `request.headers` in middleware/proxy does NOT propagate to `next/headers`'s `headers()` inside Server Components. You must construct a new `Headers` object and pass it via `NextResponse.next({ request: { headers: ... } })`. We modify the existing `updateSession` helper to do this (rather than `src/proxy.ts`) so both `NextResponse.next()` calls inside it carry the same forwarded headers.

Modify `src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  // Forward the current pathname so Server Components can read it via next/headers.
  // Mutating request.headers directly does NOT propagate — we must pass a new
  // Headers object through NextResponse.next({ request: { headers } }).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth token. Do not run code between createServerClient and getUser —
  // a stale session here can cause sign-outs and weird redirect loops.
  await supabase.auth.getUser();

  return response;
}
```

`src/proxy.ts` does NOT change in this task.

- [ ] **Step 3: Verify build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Manual verification — `?next=` bounce**

```bash
pnpm dev
```

- Sign out (if signed in).
- Visit `/dashboard` → URL becomes `/login?next=%2Fdashboard`.
- Sign in → lands on `/dashboard` (not just `/dashboard` because of the `next` param — same result here since the default is `/dashboard` too).
- For a more meaningful test, manually visit `/login?next=%2Fdashboard%2Fsettings` (a future path) → after sign-in, you land on `/dashboard/settings` (which 404s — that's fine, the redirect is the test).
- Visit `/login?next=https://evil.com` → after sign-in, you land on `/dashboard` (safeNext fallback).
- Visit `/login?next=//evil.com` → after sign-in, you land on `/dashboard` (safeNext fallback).

Stop the dev server.

- [ ] **Step 5: Run the full Phase 1 test plan**

Walk through every checkbox in the spec's "Testing (manual verification)" section. If any fails, fix it now — this is the last commit of Phase 1.

```bash
pnpm build && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(authed\)/layout.tsx src/lib/supabase/proxy.ts
git commit -m "Add ?next= bounce-back on auth redirect

updateSession() forwards an x-pathname header so the authed layout can
read the current path via next/headers, then redirect to /login?next=<path>.
Login's existing safeNext validation rejects off-origin targets, so a
malicious ?next=https://evil.com falls back to /dashboard."
```

---

## Phase 1 wrap-up

- [ ] **Run the full test plan from the spec** (`docs/superpowers/specs/2026-05-11-phase-1-auth-and-member-shell-design.md` → "Testing (manual verification)").
- [ ] **Push to origin:** `git push`
- [ ] **Append to PLANNING.md §9** with any decisions that emerged during implementation that aren't already in this spec (e.g., if `tsx` choice or the `--env-file` invocation style is worth recording).

Phase 1 is complete when:
- All 9 commits are on `main`
- All manual verification checkboxes in the spec pass
- The dev bootstrap path runs cleanly from a fresh clone (sanity-test it before claiming done)
