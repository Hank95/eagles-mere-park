# Phase 2: Directory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the directory experience — sign-in members get auto-linked to their pre-seeded `members` row, can browse a compact list of all visible households, view detail pages that respect per-field privacy, and edit their own household inline. Admins can edit any household.

**Architecture:** Server Components fetch household + member data once (RLS does the visibility filtering). A client component owns the search/filter/sort state with URL persistence. Inline edit reuses the same `/households/<id>` URL with `?edit=1`, driven by a Server Action that issues sequenced UPDATEs.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions, async params/searchParams), React 19 (`useActionState`, `useSearchParams`), Tailwind v4 + shadcn/ui, `@supabase/ssr` (server client), Supabase's RLS policies from Phase 0's migration.

**Reference spec:** `docs/superpowers/specs/2026-05-12-phase-2-directory-design.md`.

**Project rules:** Read `AGENTS.md` and `PLANNING.md` before touching code. Phase 0's `is_admin()` SQL helper + JWT `app_metadata.is_admin` are how admin checks happen. No `Co-Authored-By: Claude` in any commit.

**Testing convention for Phase 2:** No test suite (continuing Phase 1's precedent). Each task has a "Manual verification" section. Build + lint must pass at every commit.

---

## Pre-flight

Before starting any task, verify:

- [ ] On `main`, no uncommitted changes (`git status` is clean)
- [ ] `pnpm build` and `pnpm lint` pass (Phase 1 baseline)
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] You can sign in as `hhpendleton@gmail.com` (admin, seeded post-Phase-1) — confirms auth works end-to-end before the new layout-level claim helper is introduced

---

## Task 1: Claim helper + `/no-household` page + layout integration

**Files:**
- Create: `src/lib/members/claim.ts`
- Create: `src/app/(authed)/no-household/page.tsx`
- Modify: `src/app/(authed)/layout.tsx` (run the claim helper after `getUser()`)

This is the load-bearing piece. After it lands, every later task can assume "signed-in members have `members.user_id` set."

- [ ] **Step 1: Create the claim helper**

Create `src/lib/members/claim.ts`:

```ts
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
```

- [ ] **Step 2: Create the `/no-household` page**

Create `src/app/(authed)/no-household/page.tsx`:

```tsx
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function NoHouseholdPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Eagles Mere Park
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          You&apos;re not in any household yet
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Reach out to a Park board member to get added to the directory.
          They&apos;ll set up your cottage and family, and you can come back
          here.
        </p>
        <div className="pt-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Hook the claim helper into the authed layout**

Modify `src/app/(authed)/layout.tsx`. After `getUser()` succeeds, call `claimMemberRowIfNeeded` before rendering. The full file becomes:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthedShell } from "@/components/layout/authed-shell";
import { claimMemberRowIfNeeded } from "@/lib/members/claim";

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
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  await claimMemberRowIfNeeded(supabase, user);

  return <AuthedShell email={user.email ?? ""}>{children}</AuthedShell>;
}
```

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build`
Expected: success; new route `/no-household` appears.

- [ ] **Step 5: Manual verification (deferred to controller)**

Browser verification will run after Task 2 (when there's a directory to land on). The implementer should confirm static checks (build, lint) only.

- [ ] **Step 6: Commit**

```bash
git add src/lib/members src/app/\(authed\)/no-household src/app/\(authed\)/layout.tsx
git commit -m "Add member-row claim helper and /no-household landing

claimMemberRowIfNeeded runs from the authed layout on every signed-in
request. Fast-paths out if members.user_id is already set; otherwise
looks up by lowercased email against rows where user_id IS NULL and
links them. Silent — never prompts, never throws.

/no-household is the friendly landing for members who signed in but
have no matching pre-seeded row (and aren't admin). Admins with no
member row bypass it because pages decide what to render based on
both claim state and is_admin."
```

---

## Task 2: `/directory` Server Component + DirectoryList stub

**Files:**
- Create: `src/app/(authed)/directory/page.tsx`
- Create: `src/components/directory/directory-list.tsx`
- Create: `src/components/directory/household-row.tsx`
- Create: `src/components/directory/initials-avatar.tsx`

After this task, `/directory` renders a compact list of households visible to the viewer. No search/filter/sort yet; those land in Task 5.

- [ ] **Step 1: Create the initials avatar**

Create `src/components/directory/initials-avatar.tsx`:

```tsx
const PALETTE = [
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900",
  "bg-rose-200 text-rose-900",
  "bg-indigo-200 text-indigo-900",
  "bg-orange-200 text-orange-900",
  "bg-teal-200 text-teal-900",
  "bg-fuchsia-200 text-fuchsia-900",
] as const;

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function InitialsAvatar({
  name,
  className = "h-10 w-10",
}: {
  name: string;
  className?: string;
}) {
  const colors = pickColor(name);
  return (
    <div
      className={`flex items-center justify-center rounded-full text-sm font-medium ${colors} ${className}`}
      aria-hidden="true"
    >
      {initialsFrom(name)}
    </div>
  );
}
```

- [ ] **Step 2: Create the household row**

Create `src/components/directory/household-row.tsx`:

```tsx
import { InitialsAvatar } from "@/components/directory/initials-avatar";
import type { Database } from "@/lib/database.types";

type HouseholdSummary = Pick<
  Database["public"]["Tables"]["households"]["Row"],
  "id" | "cottage_name" | "arrival_year" | "is_year_round" | "is_unlisted"
> & {
  members: Pick<
    Database["public"]["Tables"]["members"]["Row"],
    "name" | "role"
  >[];
};

function familyLastNames(members: HouseholdSummary["members"]): string {
  const lastNames = new Set(
    members
      .map((m) => m.name.trim().split(/\s+/).pop() ?? "")
      .filter(Boolean),
  );
  if (lastNames.size === 0) return "";
  return Array.from(lastNames).join(" / ");
}

export function HouseholdRow({
  household,
  showUnlistedIndicator,
}: {
  household: HouseholdSummary;
  showUnlistedIndicator: boolean;
}) {
  const family = familyLastNames(household.members);
  const unlisted = showUnlistedIndicator && household.is_unlisted;

  return (
    <a
      href={`/households/${household.id}`}
      className={`flex items-center gap-4 border-b border-border px-4 py-3 hover:bg-muted/50 ${
        unlisted ? "italic" : ""
      }`}
    >
      <InitialsAvatar name={household.cottage_name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{household.cottage_name}</span>
          {unlisted ? (
            <span
              aria-label="Unlisted"
              title="Unlisted"
              className="text-xs text-muted-foreground"
            >
              🔒
            </span>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground">
          {family || "—"}
          {household.arrival_year ? ` · since ${household.arrival_year}` : ""}
        </div>
      </div>
      <div className="hidden sm:block text-xs uppercase tracking-wider text-muted-foreground">
        {household.is_year_round ? "Year-round" : "Seasonal"}
      </div>
      <span aria-hidden="true" className="text-muted-foreground">
        ›
      </span>
    </a>
  );
}

export type { HouseholdSummary };
```

- [ ] **Step 3: Create the DirectoryList client component (no filtering yet)**

Create `src/components/directory/directory-list.tsx`:

```tsx
"use client";

import { HouseholdRow, type HouseholdSummary } from "@/components/directory/household-row";

export function DirectoryList({
  households,
  viewerIsAdmin,
}: {
  households: HouseholdSummary[];
  viewerIsAdmin: boolean;
}) {
  if (households.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No households to show yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {households.map((h) => (
        <HouseholdRow
          key={h.id}
          household={h}
          showUnlistedIndicator={viewerIsAdmin}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the directory page**

Create `src/app/(authed)/directory/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectoryList } from "@/components/directory/directory-list";

function getIsAdmin(user: { app_metadata?: { is_admin?: unknown } }): boolean {
  return user.app_metadata?.is_admin === true;
}

export default async function DirectoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The layout already redirected to /login if unauthed.
  if (!user) return null;
  const isAdmin = getIsAdmin(user);

  // If this viewer isn't admin and has no member row, send them to /no-household.
  if (!isAdmin) {
    const { data: own } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!own) redirect("/no-household");
  }

  const { data: households, error } = await supabase
    .from("households")
    .select(
      "id, cottage_name, arrival_year, is_year_round, is_unlisted, members(name, role)",
    )
    .order("cottage_name", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600">
          Could not load directory: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Directory</h1>
        <p className="text-sm text-muted-foreground">
          {households.length} household{households.length === 1 ? "" : "s"}
        </p>
      </header>
      <DirectoryList households={households ?? []} viewerIsAdmin={isAdmin} />
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: `/directory` appears in route table as `ƒ`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(authed\)/directory src/components/directory
git commit -m "Add /directory list view with row + initials avatar

Server Component fetches households + member sub-rows (RLS handles
visibility filtering — unlisted households are hidden from non-admin
non-members, etc.). Client DirectoryList renders a compact list with
the InitialsAvatar fallback (no photo upload until Phase 5).

Admins see a 🔒 indicator on unlisted households. Non-admins without
any member row are redirected to /no-household at the page level —
the layout-level claim helper handles the linking; the page handles
the no-match state.

No search/filter/sort yet; those land next."
```

---

## Task 3: "Directory" nav link in the authed shell

**Files:**
- Modify: `src/components/layout/authed-shell.tsx`

- [ ] **Step 1: Add the Directory link to the header**

Modify the `AuthedShell` header to include the Directory link. The full updated component:

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
          <div className="flex items-center gap-6">
            <a
              href="/dashboard"
              className="text-sm font-semibold tracking-tight"
            >
              Eagles Mere Park
            </a>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="/directory" className="hover:text-foreground">
                Directory
              </a>
            </nav>
          </div>
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

- [ ] **Step 2: Verify build**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/authed-shell.tsx
git commit -m "Add Directory link to the authed shell nav"
```

---

## Task 4: Search / filter / sort with URL persistence

**Files:**
- Modify: `src/components/directory/directory-list.tsx`

The page still server-fetches all households; this task adds the client-side search/filter/sort interactions on top of that data, with state persisted in the URL.

- [ ] **Step 1: Replace `DirectoryList` with the interactive version**

Replace `src/components/directory/directory-list.tsx` with:

```tsx
"use client";

import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HouseholdRow,
  type HouseholdSummary,
} from "@/components/directory/household-row";

type SortKey = "cottage_name" | "family_name" | "arrival_year";
type SeasonFilter = "all" | "year-round" | "seasonal";

function lastName(h: HouseholdSummary): string {
  return (
    h.members[0]?.name.trim().split(/\s+/).pop()?.toLowerCase() ?? ""
  );
}

function compareByCottage(a: HouseholdSummary, b: HouseholdSummary): number {
  return a.cottage_name.localeCompare(b.cottage_name);
}

function compareByFamily(a: HouseholdSummary, b: HouseholdSummary): number {
  return lastName(a).localeCompare(lastName(b));
}

function compareByYear(a: HouseholdSummary, b: HouseholdSummary): number {
  return (a.arrival_year ?? Number.POSITIVE_INFINITY) -
    (b.arrival_year ?? Number.POSITIVE_INFINITY);
}

function comparator(sort: SortKey) {
  if (sort === "family_name") return compareByFamily;
  if (sort === "arrival_year") return compareByYear;
  return compareByCottage;
}

function searchMatches(h: HouseholdSummary, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (h.cottage_name.toLowerCase().includes(q)) return true;
  for (const m of h.members) {
    if (m.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

function seasonMatches(h: HouseholdSummary, season: SeasonFilter): boolean {
  if (season === "all") return true;
  if (season === "year-round") return h.is_year_round === true;
  return h.is_year_round === false;
}

export function DirectoryList({
  households,
  viewerIsAdmin,
}: {
  households: HouseholdSummary[];
  viewerIsAdmin: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const query = params.get("q") ?? "";
  const season = (params.get("season") as SeasonFilter) ?? "all";
  const sort = (params.get("sort") as SortKey) ?? "cottage_name";

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || (name === "sort" && value === "cottage_name")) {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    startTransition(() => {
      router.replace(`/directory${next.toString() ? `?${next.toString()}` : ""}`);
    });
  }

  const filtered = useMemo(() => {
    const result = households
      .filter((h) => searchMatches(h, query))
      .filter((h) => seasonMatches(h, season));
    result.sort(comparator(sort));
    return result;
  }, [households, query, season, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          defaultValue={query}
          placeholder="Search by name or cottage"
          onChange={(e) => updateParam("q", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs"
        />
        <div className="flex gap-2">
          <select
            value={season}
            onChange={(e) => updateParam("season", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All seasons</option>
            <option value="year-round">Year-round</option>
            <option value="seasonal">Seasonal</option>
          </select>
          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="cottage_name">Sort: Cottage</option>
            <option value="family_name">Sort: Family</option>
            <option value="arrival_year">Sort: Arrival year</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No households match.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {filtered.map((h) => (
            <HouseholdRow
              key={h.id}
              household={h}
              showUnlistedIndicator={viewerIsAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/directory/directory-list.tsx
git commit -m "Add search, season filter, and sort to /directory

State is URL-persisted via useSearchParams + router.replace inside a
transition (no scroll jumps, back/forward works, links shareable).
Filter and sort run client-side over the server-fetched dataset —
no per-keystroke round-trip. Defaults (empty query, all seasons,
sort by cottage_name) omit the param from the URL for clean links."
```

---

## Task 5: `/households/[id]` read view + visibility helper

**Files:**
- Create: `src/lib/households/visibility.ts`
- Create: `src/components/households/household-detail-read.tsx`
- Create: `src/app/(authed)/households/[id]/page.tsx`

- [ ] **Step 1: Create the visibility helper**

Create `src/lib/households/visibility.ts`:

```ts
import type { Database } from "@/lib/database.types";

export type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export type ViewerContext = {
  id: string;
  isAdmin: boolean;
  householdId: string | null;
};

export type VisibleMember = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
};

export function filterMemberForViewer(
  member: MemberRow,
  viewer: ViewerContext,
): VisibleMember {
  const sameHousehold = viewer.householdId === member.household_id;
  const isSelf = viewer.id === member.user_id;
  const see = (publicFlag: boolean) =>
    publicFlag || viewer.isAdmin || sameHousehold || isSelf;

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    email: see(member.email_is_public) ? member.email : null,
    phone: see(member.phone_is_public) ? member.phone : null,
  };
}

export function shouldShowAddress(
  household: HouseholdRow & { members: MemberRow[] },
  viewer: ViewerContext,
): boolean {
  if (viewer.isAdmin) return true;
  if (viewer.householdId === household.id) return true;
  return household.members.some((m) => m.address_is_public);
}
```

- [ ] **Step 2: Create the read component**

Create `src/components/households/household-detail-read.tsx`:

```tsx
import { InitialsAvatar } from "@/components/directory/initials-avatar";
import {
  shouldShowAddress,
  type HouseholdRow,
  type MemberRow,
  type ViewerContext,
  filterMemberForViewer,
} from "@/lib/households/visibility";

type HouseholdWithMembers = HouseholdRow & { members: MemberRow[] };

export function HouseholdDetailRead({
  household,
  viewer,
  canEdit,
}: {
  household: HouseholdWithMembers;
  viewer: ViewerContext;
  canEdit: boolean;
}) {
  const showAddress = shouldShowAddress(household, viewer);
  const visibleMembers = household.members.map((m) =>
    filterMemberForViewer(m, viewer),
  );

  return (
    <article className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <InitialsAvatar
            name={household.cottage_name}
            className="h-14 w-14 text-base"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {household.cottage_name}
              </h1>
              {household.is_unlisted ? (
                <span
                  aria-label="Unlisted"
                  title="Unlisted"
                  className="text-sm text-muted-foreground"
                >
                  🔒
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {household.is_year_round ? "Year-round" : "Seasonal"}
              {household.arrival_year
                ? ` · arrived ${household.arrival_year}`
                : ""}
            </p>
          </div>
        </div>
        {canEdit ? (
          <a
            href={`/households/${household.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        ) : null}
      </header>

      {showAddress && household.street_address ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Address
          </h2>
          <p className="mt-1 text-sm">{household.street_address}</p>
        </section>
      ) : null}

      {household.bio ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            About
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {household.bio}
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Family
        </h2>
        <ul className="mt-2 space-y-3">
          {visibleMembers.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-border px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{m.name}</p>
                {m.role ? (
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                ) : null}
              </div>
              {(m.email || m.phone) ? (
                <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                  {m.email ? (
                    <>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground sm:self-center">
                        Email
                      </dt>
                      <dd>
                        <a
                          href={`mailto:${m.email}`}
                          className="underline underline-offset-2"
                        >
                          {m.email}
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {m.phone ? (
                    <>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground sm:self-center">
                        Phone
                      </dt>
                      <dd>{m.phone}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
```

- [ ] **Step 3: Create the household detail page (read-only for now)**

Create `src/app/(authed)/households/[id]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { HouseholdDetailRead } from "@/components/households/household-detail-read";
import type { ViewerContext } from "@/lib/households/visibility";

function isAdmin(user: { app_metadata?: { is_admin?: unknown } }): boolean {
  return user.app_metadata?.is_admin === true;
}

export default async function HouseholdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: household } = await supabase
    .from("households")
    .select("*, members(*)")
    .eq("id", id)
    .maybeSingle();

  if (!household) notFound();

  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const viewer: ViewerContext = {
    id: user.id,
    isAdmin: isAdmin(user),
    householdId: own?.household_id ?? null,
  };

  const canEdit = viewer.isAdmin || viewer.householdId === household.id;

  return (
    <HouseholdDetailRead
      household={household}
      viewer={viewer}
      canEdit={canEdit}
    />
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: success; `/households/[id]` appears as `ƒ`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/households/visibility.ts src/components/households src/app/\(authed\)/households
git commit -m "Add /households/[id] read view with privacy-aware rendering

Visibility helper centralizes the per-field rules: a contact field is
shown when the viewer is admin, lives in the same household, is the
member themselves, or the field's _is_public flag is true. Address
lives on households.street_address but the privacy gate is per-member;
shouldShowAddress uses any-member-public so a household with even one
opted-in member is reachable for non-members.

canEdit (admin OR same household) drives the Edit button visibility.
The actual edit form lands in the next task; the link goes to ?edit=1
which the page will route to in Task 7."
```

---

## Task 6: Edit toggle + `HouseholdEditForm` scaffold (no save yet)

**Files:**
- Create: `src/components/households/household-edit-form.tsx`
- Create: `src/components/households/member-edit-row.tsx`
- Modify: `src/app/(authed)/households/[id]/page.tsx` (route to read vs edit based on `?edit=1`)

This task renders the edit form when authorized viewers visit `?edit=1`, but the form's submit is a no-op until Task 7 wires the Server Action.

- [ ] **Step 1: Create the member-edit row**

Create `src/components/households/member-edit-row.tsx`:

```tsx
"use client";

import type { Database } from "@/lib/database.types";

export type MemberFormRow = Database["public"]["Tables"]["members"]["Row"];

export function MemberEditRow({ member }: { member: MemberFormRow }) {
  const prefix = `member.${member.id}.`;

  return (
    <li className="rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}name`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Name
          </label>
          <input
            id={`${prefix}name`}
            name={`${prefix}name`}
            defaultValue={member.name}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}role`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Role
          </label>
          <input
            id={`${prefix}role`}
            name={`${prefix}role`}
            defaultValue={member.role ?? ""}
            placeholder="year-round / summer / extended family"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}email`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Email
          </label>
          <input
            id={`${prefix}email`}
            name={`${prefix}email`}
            type="email"
            defaultValue={member.email ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}phone`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Phone
          </label>
          <input
            id={`${prefix}phone`}
            name={`${prefix}phone`}
            type="tel"
            defaultValue={member.phone ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Privacy toggles for the contact fields land in the next iteration.
      </p>
    </li>
  );
}
```

The privacy toggles are intentionally absent here — they land in Task 8. This task just renders editable fields.

- [ ] **Step 2: Create the household edit form scaffold**

Create `src/components/households/household-edit-form.tsx`:

```tsx
"use client";

import { MemberEditRow } from "@/components/households/member-edit-row";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";

type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export function HouseholdEditForm({
  household,
}: {
  household: HouseholdRow & { members: MemberRow[] };
}) {
  return (
    <form className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <input type="hidden" name="id" value={household.id} />

      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit {household.cottage_name}
        </h1>
        <a
          href={`/households/${household.id}`}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Cancel
        </a>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="cottage_name" className="text-sm font-medium">
            Cottage name
          </label>
          <input
            id="cottage_name"
            name="cottage_name"
            defaultValue={household.cottage_name}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="street_address" className="text-sm font-medium">
            Street address
          </label>
          <input
            id="street_address"
            name="street_address"
            defaultValue={household.street_address ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="arrival_year" className="text-sm font-medium">
            Arrival year
          </label>
          <input
            id="arrival_year"
            name="arrival_year"
            type="number"
            min="1850"
            max="2100"
            defaultValue={household.arrival_year ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_year_round"
              defaultChecked={household.is_year_round}
              className="h-4 w-4"
            />
            Year-round residents
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_unlisted"
              defaultChecked={household.is_unlisted}
              className="h-4 w-4"
            />
            Unlisted — hide from other members
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="bio" className="text-sm font-medium">
            About
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={household.bio ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Family
        </h2>
        <ul className="mt-2 space-y-3">
          {household.members.map((m) => (
            <MemberEditRow key={m.id} member={m} />
          ))}
        </ul>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled>
          Save (wiring in next task)
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Route between read and edit on the page**

Modify `src/app/(authed)/households/[id]/page.tsx`. Add `searchParams` to the props, import the edit form, and branch:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { HouseholdDetailRead } from "@/components/households/household-detail-read";
import { HouseholdEditForm } from "@/components/households/household-edit-form";
import type { ViewerContext } from "@/lib/households/visibility";

function isAdmin(user: { app_metadata?: { is_admin?: unknown } }): boolean {
  return user.app_metadata?.is_admin === true;
}

export default async function HouseholdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: household } = await supabase
    .from("households")
    .select("*, members(*)")
    .eq("id", id)
    .maybeSingle();
  if (!household) notFound();

  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const viewer: ViewerContext = {
    id: user.id,
    isAdmin: isAdmin(user),
    householdId: own?.household_id ?? null,
  };
  const canEdit = viewer.isAdmin || viewer.householdId === household.id;

  if (edit === "1") {
    if (!canEdit) redirect(`/households/${household.id}`);
    return <HouseholdEditForm household={household} />;
  }

  return (
    <HouseholdDetailRead
      household={household}
      viewer={viewer}
      canEdit={canEdit}
    />
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add src/components/households/household-edit-form.tsx src/components/households/member-edit-row.tsx src/app/\(authed\)/households/\[id\]/page.tsx
git commit -m "Add edit-mode form scaffold on /households/[id]?edit=1

Edit form renders for authorized viewers (own household or admin)
when ?edit=1 is present; an unauthorized viewer is redirected back
to the read view. The submit button is disabled until the Server
Action lands in the next task. Privacy toggles arrive in Task 8."
```

---

## Task 7: `updateHousehold` Server Action + wire the form

**Files:**
- Create: `src/lib/households/actions.ts`
- Modify: `src/components/households/household-edit-form.tsx` (wire `useActionState`)

- [ ] **Step 1: Create the Server Action**

Create `src/lib/households/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type UpdateHouseholdState = { error?: string } | undefined;

function asTextOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function asIntOrNull(value: FormDataEntryValue | null): number | null {
  const s = asTextOrNull(value);
  if (s === null) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

type MemberUpdate = {
  id: string;
  name?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
};

function collectMemberUpdates(formData: FormData): MemberUpdate[] {
  const byId = new Map<string, MemberUpdate>();
  for (const [key, value] of formData.entries()) {
    const match = /^member\.([^.]+)\.(.+)$/.exec(key);
    if (!match) continue;
    const [, id, field] = match;
    const update = byId.get(id) ?? { id };
    if (field === "name") update.name = String(value).trim();
    else if (field === "role") update.role = asTextOrNull(value);
    else if (field === "email") update.email = asTextOrNull(value);
    else if (field === "phone") update.phone = asTextOrNull(value);
    byId.set(id, update);
  }
  return Array.from(byId.values());
}

export async function updateHousehold(
  _prev: UpdateHouseholdState,
  formData: FormData,
): Promise<UpdateHouseholdState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing household id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const householdPatch = {
    cottage_name: String(formData.get("cottage_name") ?? "").trim(),
    street_address: asTextOrNull(formData.get("street_address")),
    arrival_year: asIntOrNull(formData.get("arrival_year")),
    is_year_round: formData.get("is_year_round") === "on",
    is_unlisted: formData.get("is_unlisted") === "on",
    bio: asTextOrNull(formData.get("bio")),
  };

  if (!householdPatch.cottage_name) {
    return { error: "Cottage name is required." };
  }

  // RLS authoritatively blocks an unauthorized write; the app-layer check
  // exists for friendlier error messages.
  const { error: hhError } = await supabase
    .from("households")
    .update(householdPatch)
    .eq("id", id);
  if (hhError) {
    return { error: `Could not save household: ${hhError.message}` };
  }

  const memberUpdates = collectMemberUpdates(formData);
  for (const m of memberUpdates) {
    const { id: memberId, ...patch } = m;
    if (Object.keys(patch).length === 0) continue;
    if (patch.name !== undefined && patch.name === "") {
      return { error: "Member name cannot be empty." };
    }
    const { error: mError } = await supabase
      .from("members")
      .update(patch)
      .eq("id", memberId);
    if (mError) {
      return {
        error: `Could not save member ${memberId}: ${mError.message}`,
      };
    }
  }

  revalidatePath(`/households/${id}`);
  revalidatePath("/directory");
  redirect(`/households/${id}`);
}
```

- [ ] **Step 2: Wire the form to the action**

Replace the contents of `src/components/households/household-edit-form.tsx` with:

```tsx
"use client";

import { useActionState } from "react";
import { MemberEditRow } from "@/components/households/member-edit-row";
import {
  updateHousehold,
  type UpdateHouseholdState,
} from "@/lib/households/actions";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";

type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export function HouseholdEditForm({
  household,
}: {
  household: HouseholdRow & { members: MemberRow[] };
}) {
  const [state, action, pending] = useActionState<
    UpdateHouseholdState,
    FormData
  >(updateHousehold, undefined);

  return (
    <form action={action} className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <input type="hidden" name="id" value={household.id} />

      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit {household.cottage_name}
        </h1>
        <a
          href={`/households/${household.id}`}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Cancel
        </a>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="cottage_name" className="text-sm font-medium">
            Cottage name
          </label>
          <input
            id="cottage_name"
            name="cottage_name"
            defaultValue={household.cottage_name}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="street_address" className="text-sm font-medium">
            Street address
          </label>
          <input
            id="street_address"
            name="street_address"
            defaultValue={household.street_address ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="arrival_year" className="text-sm font-medium">
            Arrival year
          </label>
          <input
            id="arrival_year"
            name="arrival_year"
            type="number"
            min="1850"
            max="2100"
            defaultValue={household.arrival_year ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_year_round"
              defaultChecked={household.is_year_round}
              className="h-4 w-4"
            />
            Year-round residents
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_unlisted"
              defaultChecked={household.is_unlisted}
              className="h-4 w-4"
            />
            Unlisted — hide from other members
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="bio" className="text-sm font-medium">
            About
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={household.bio ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Family
        </h2>
        <ul className="mt-2 space-y-3">
          {household.members.map((m) => (
            <MemberEditRow key={m.id} member={m} />
          ))}
        </ul>
      </section>

      {state?.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/lib/households/actions.ts src/components/households/household-edit-form.tsx
git commit -m "Wire updateHousehold Server Action to the edit form

Action parses the form's household-level fields plus per-member fields
(name-encoded as 'member.<id>.<field>'), runs sequenced UPDATEs, and
revalidates both /directory and /households/[id] before redirecting
back to the read view. RLS is the authoritative gate on unauthorized
writes; the action-layer error messages exist for friendlier UX.

Privacy toggles for member contact fields land in the next task."
```

---

## Task 8: Privacy toggles in the edit form (and respected by the action)

**Files:**
- Modify: `src/components/households/member-edit-row.tsx` (add the three toggles)
- Modify: `src/lib/households/actions.ts` (read the toggles from formData)

- [ ] **Step 1: Add the toggles to the member row**

Replace `src/components/households/member-edit-row.tsx` with:

```tsx
"use client";

import type { Database } from "@/lib/database.types";

export type MemberFormRow = Database["public"]["Tables"]["members"]["Row"];

function PrivacyToggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-3 w-3"
      />
      {label}
    </label>
  );
}

export function MemberEditRow({ member }: { member: MemberFormRow }) {
  const prefix = `member.${member.id}.`;

  return (
    <li className="rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}name`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Name
          </label>
          <input
            id={`${prefix}name`}
            name={`${prefix}name`}
            defaultValue={member.name}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${prefix}role`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Role
          </label>
          <input
            id={`${prefix}role`}
            name={`${prefix}role`}
            defaultValue={member.role ?? ""}
            placeholder="year-round / summer / extended family"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${prefix}email`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Email
          </label>
          <input
            id={`${prefix}email`}
            name={`${prefix}email`}
            type="email"
            defaultValue={member.email ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <PrivacyToggle
            name={`${prefix}email_is_public`}
            defaultChecked={member.email_is_public}
            label="Visible to other members"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${prefix}phone`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Phone
          </label>
          <input
            id={`${prefix}phone`}
            name={`${prefix}phone`}
            type="tel"
            defaultValue={member.phone ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <PrivacyToggle
            name={`${prefix}phone_is_public`}
            defaultChecked={member.phone_is_public}
            label="Visible to other members"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <PrivacyToggle
            name={`${prefix}address_is_public`}
            defaultChecked={member.address_is_public}
            label="Share household address with other members"
          />
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Read the toggles in the action**

Modify `src/lib/households/actions.ts`. Update `MemberUpdate` and `collectMemberUpdates`:

```ts
type MemberUpdate = {
  id: string;
  name?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  email_is_public?: boolean;
  phone_is_public?: boolean;
  address_is_public?: boolean;
};

function collectMemberUpdates(formData: FormData): MemberUpdate[] {
  const byId = new Map<string, MemberUpdate>();
  const ids = new Set<string>();
  for (const key of formData.keys()) {
    const match = /^member\.([^.]+)\./.exec(key);
    if (match) ids.add(match[1]);
  }

  for (const id of ids) {
    const get = (field: string) => formData.get(`member.${id}.${field}`);
    const update: MemberUpdate = { id };
    const nameVal = get("name");
    if (nameVal !== null) update.name = String(nameVal).trim();
    const roleVal = get("role");
    if (roleVal !== null) update.role = asTextOrNull(roleVal);
    const emailVal = get("email");
    if (emailVal !== null) update.email = asTextOrNull(emailVal);
    const phoneVal = get("phone");
    if (phoneVal !== null) update.phone = asTextOrNull(phoneVal);
    // Checkboxes: only present in FormData when checked. Always set the
    // flag based on presence so unchecking is recorded.
    update.email_is_public = get("email_is_public") === "on";
    update.phone_is_public = get("phone_is_public") === "on";
    update.address_is_public = get("address_is_public") === "on";
    byId.set(id, update);
  }
  return Array.from(byId.values());
}
```

The rest of the action (validation, sequenced UPDATEs, revalidatePath, redirect) stays unchanged — `members.update(patch)` already takes whatever fields are in `patch`.

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/components/households/member-edit-row.tsx src/lib/households/actions.ts
git commit -m "Add per-field privacy toggles to the edit form

Each member's contact fields get a 'Visible to other members' checkbox;
the action records the value based on FormData presence (unchecked
boxes are absent, so we explicitly set the boolean off in that case
rather than skipping the field). The read view's filterMemberForViewer
already honors these flags, so toggling them takes effect on the next
detail-page render."
```

---

## Task 9: Polish — empty states, validation, sign-out edge case

**Files:**
- Modify: `src/lib/households/actions.ts` (basic email validation)
- Modify: `src/app/(authed)/dashboard/page.tsx` (link to /directory)

- [ ] **Step 1: Add email-format validation to the action**

In `src/lib/households/actions.ts`, before the member-update loop, add:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
for (const m of memberUpdates) {
  if (m.email !== undefined && m.email !== null && !EMAIL_RE.test(m.email)) {
    return { error: `'${m.email}' is not a valid email address.` };
  }
}
```

Place this immediately after `const memberUpdates = collectMemberUpdates(formData);` and before the existing `for (const m of memberUpdates) { ... }` write loop. The two loops can coexist — the first validates, the second writes.

- [ ] **Step 2: Add a Directory link to /dashboard**

Modify `src/app/(authed)/dashboard/page.tsx`:

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
          Browse the <a href="/directory" className="underline underline-offset-2">directory</a>.
          Events, map, photos, and documents are on the way.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Run the full Phase 2 manual test plan** (from the spec, lines under "Testing (manual verification)") and confirm each passes. Any failure stops the task — fix before committing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/households/actions.ts src/app/\(authed\)/dashboard/page.tsx
git commit -m "Validate member email format and link /dashboard to /directory

Empty-string emails are still allowed (treated as 'cleared'); only
non-empty values that fail the basic email shape produce a form
error. /dashboard now mentions the directory so first-time members
have an obvious next click after sign-in."
```

---

## Phase 2 wrap-up

- [ ] **Run the full test plan** from the spec's "Testing (manual verification)" section one more time after all 9 tasks are committed.
- [ ] **Push to origin:** `git push`
- [ ] **Append to `PLANNING.md` §9** with any decisions that emerged during implementation that aren't already in this spec.

Phase 2 is complete when:
- All 9 commits are on `main`
- Every checkbox in the spec's test plan passes
- A fresh test user (created via `pnpm invite-member`) can:
  1. Click their invite email
  2. Set a password
  3. Land on `/dashboard` with their email visible in the shell
  4. Click "Directory" and see the household they were invited into
  5. Open their household detail and click Edit
  6. Change a bio and toggle their email privacy off
  7. Save and see the read view reflect the change
- An admin (`hhpendleton@gmail.com`) can do steps 4–7 on any household.
