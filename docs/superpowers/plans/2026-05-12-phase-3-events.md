# Phase 3: Events & Announcements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the events experience — members create events, RSVP per household, admins flag announcements, everyone browses a chronological feed or a month calendar. Past events stay reachable as community history.

**Architecture:** Two new tables (`events`, `rsvps`) with full RLS. Server Components fetch and render; Client Components handle interactive bits (feed toggle, RSVP form, calendar navigation). Server Actions in `src/lib/events/actions.ts` and `src/lib/rsvps/actions.ts` mutate. Timezone is hardcoded America/New_York for display; UTC in storage; two inline helpers handle the round-trip with no date library dep.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions, async params/searchParams), React 19 (`useActionState`, `useSearchParams`), Tailwind v4 + shadcn/ui, `@supabase/ssr`, Postgres + RLS. `Intl.DateTimeFormat` for all date/time rendering.

**Reference spec:** `docs/superpowers/specs/2026-05-12-phase-3-events-design.md`.

**Project rules:** Read `AGENTS.md` and `PLANNING.md` before touching code. Phase 2 patterns apply: shared `isAdmin` helper at `@/lib/auth/is-admin`, `?edit=1` inline edit, RLS authoritative + app-layer friendly errors. No `Co-Authored-By: Claude` in any commit.

**Testing convention:** No automated test suite (continuing Phases 1–2). Each task has a "Manual verification" section. Build + lint must pass at every commit.

---

## Pre-flight

Before starting any task, verify:

- [ ] On `main`, no uncommitted changes (`git status` is clean)
- [ ] `pnpm build` and `pnpm lint` pass (Phase 2 baseline)
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] You can sign in as `hhpendleton@gmail.com` (admin) and reach `/directory`
- [ ] Phase 2's three migrations are applied (`supabase migration list` shows `20260511230231`, `20260512122422`, `20260512215751`, `20260512221015`)

---

## Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/<timestamp>_create_events_and_rsvps.sql` (filename written by `supabase migration new`)
- Regenerate: `src/lib/database.types.ts`

- [ ] **Step 1: Create the migration file**

```bash
supabase migration new create_events_and_rsvps
```

This creates an empty migration file with a timestamp.

- [ ] **Step 2: Write the migration**

Put this SQL into the new migration file:

```sql
-- Phase 3: events + rsvps
-- See docs/superpowers/specs/2026-05-12-phase-3-events-design.md
--
-- events: any authed user creates (admin required for is_announcement).
-- rsvps:  one per household per event (unique), per-household with optional headcount.

-- ============================================================================
-- events
-- ============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  is_announcement boolean not null default false,
  rsvp_enabled boolean not null default true,
  photo_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_starts_at_idx on public.events(starts_at);

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;

-- Any authed user can read events.
create policy "events_select"
on public.events for select
to authenticated
using (true);

-- Authed users insert their own events. is_announcement requires admin.
create policy "events_insert"
on public.events for insert
to authenticated
with check (
  created_by = auth.uid()
  and (is_announcement = false or public.is_admin())
);

-- Update: own events or admin. is_announcement still requires admin to be true.
create policy "events_update"
on public.events for update
to authenticated
using (public.is_admin() or created_by = auth.uid())
with check (
  (public.is_admin() or created_by = auth.uid())
  and (is_announcement = false or public.is_admin())
);

create policy "events_delete"
on public.events for delete
to authenticated
using (public.is_admin() or created_by = auth.uid());

-- ============================================================================
-- rsvps
-- ============================================================================

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  headcount integer check (headcount is null or headcount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, household_id)
);

create index rsvps_event_id_idx on public.rsvps(event_id);

create trigger rsvps_set_updated_at
before update on public.rsvps
for each row execute function public.set_updated_at();

alter table public.rsvps enable row level security;

-- RSVPs are community-visible to any authed user.
create policy "rsvps_select"
on public.rsvps for select
to authenticated
using (true);

-- Insert / update / delete: only the household's own RSVP, or admin override.
create policy "rsvps_insert"
on public.rsvps for insert
to authenticated
with check (
  household_id = public.current_user_household_id()
  or public.is_admin()
);

create policy "rsvps_update"
on public.rsvps for update
to authenticated
using (
  household_id = public.current_user_household_id()
  or public.is_admin()
)
with check (
  household_id = public.current_user_household_id()
  or public.is_admin()
);

create policy "rsvps_delete"
on public.rsvps for delete
to authenticated
using (
  household_id = public.current_user_household_id()
  or public.is_admin()
);
```

- [ ] **Step 3: Apply the migration to the remote DB**

```bash
echo "Y" | supabase db push --linked
```

Expected: "Finished supabase db push." and the new migration appears in `supabase migration list`.

- [ ] **Step 4: Regenerate TypeScript types**

```bash
pnpm types:gen
```

Expected: `src/lib/database.types.ts` now includes `events` and `rsvps` rows. Check `git diff src/lib/database.types.ts` to confirm.

- [ ] **Step 5: Verify build still passes**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ src/lib/database.types.ts
git commit -m "Create events and rsvps tables with RLS

events: created_by FK to auth.users with ON DELETE RESTRICT (preserves
event history when a member leaves). is_announcement flag gated by
is_admin() in both INSERT and UPDATE WITH CHECK.

rsvps: one row per (event, household) — per-household RSVPs with optional
headcount. RLS lets a member upsert/delete only their own household's
RSVP; admins can override.

Schema, indexes, triggers, RLS, and types regenerated. PLANNING.md §9
note about per-household RSVPs (deviation from §5.2's per-member sketch)
will be appended in the Phase 3 wrap-up."
```

---

## Task 2: Format helpers + `/events` feed (upcoming default)

**Files:**
- Create: `src/lib/events/format.ts`
- Create: `src/components/events/announcement-chip.tsx`
- Create: `src/components/events/event-card.tsx`
- Create: `src/components/events/event-feed.tsx`
- Create: `src/app/(authed)/events/page.tsx`

After this task, `/events` renders a list of upcoming events with a toggle to past events.

- [ ] **Step 1: Create the timezone + date format helpers**

Create `src/lib/events/format.ts`:

```ts
const TIMEZONE = "America/New_York";

const eventDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const eventDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const eventTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function formatEventDateTime(date: string | Date): string {
  return eventDateTimeFormatter.format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function formatEventDate(date: string | Date): string {
  return eventDateFormatter.format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function formatEventTime(date: string | Date): string {
  return eventTimeFormatter.format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function isUpcoming(starts_at: string): boolean {
  return new Date(starts_at).getTime() >= Date.now();
}

/**
 * Convert a UTC timestamp to the string a `<input type="datetime-local">`
 * accepts ("YYYY-MM-DDTHH:MM"), in Eastern time. Used to pre-populate the
 * edit form for an existing event.
 */
export function easternDateInputValue(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Convert a `<input type="datetime-local">` value (a string like
 * "2026-07-04T16:00", which has no inherent timezone) into a UTC ISO string,
 * interpreting the input as Eastern time. Handles DST by round-trip checking
 * both -4 (EDT) and -5 (EST) offsets.
 */
export function easternDateFromInput(inputString: string): string {
  const [datePart, timePart] = inputString.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);

  // Try EDT (UTC-4) first
  const guessEdt = new Date(Date.UTC(y, mo - 1, d, h + 4, mi));
  if (easternDateInputValue(guessEdt) === inputString) {
    return guessEdt.toISOString();
  }
  // Otherwise EST (UTC-5)
  const guessEst = new Date(Date.UTC(y, mo - 1, d, h + 5, mi));
  return guessEst.toISOString();
}
```

- [ ] **Step 2: Create the announcement chip**

Create `src/components/events/announcement-chip.tsx`:

```tsx
export function AnnouncementChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      Announcement
    </span>
  );
}
```

- [ ] **Step 3: Create the event card**

Create `src/components/events/event-card.tsx`:

```tsx
import { AnnouncementChip } from "@/components/events/announcement-chip";
import { formatEventDateTime } from "@/lib/events/format";
import type { Database } from "@/lib/database.types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type EventCardData = EventRow & {
  creator_name: string | null; // null → "(unlisted)"
  rsvp_summary: {
    yes: number;
    no: number;
    maybe: number;
    headcount: number;
  };
};

export function EventCard({ event }: { event: EventCardData }) {
  return (
    <a
      href={`/events/${event.id}`}
      className="block border-b border-border px-4 py-4 hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        {event.is_announcement ? <AnnouncementChip /> : null}
        <h3 className="font-medium">{event.title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatEventDateTime(event.starts_at)}
        {event.location ? ` · ${event.location}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Posted by {event.creator_name ?? "(unlisted)"}
        {event.rsvp_summary.yes > 0
          ? ` · ${event.rsvp_summary.yes} household${event.rsvp_summary.yes === 1 ? "" : "s"} attending${
              event.rsvp_summary.headcount > 0
                ? ` (${event.rsvp_summary.headcount} ${event.rsvp_summary.headcount === 1 ? "person" : "people"})`
                : ""
            }`
          : ""}
      </p>
    </a>
  );
}
```

- [ ] **Step 4: Create the feed client component**

Create `src/components/events/event-feed.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventCard, type EventCardData } from "@/components/events/event-card";

export function EventFeed({ events }: { events: EventCardData[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const past = params.get("past") === "1";

  function togglePast() {
    const next = new URLSearchParams(params.toString());
    if (past) {
      next.delete("past");
    } else {
      next.set("past", "1");
    }
    startTransition(() => {
      router.replace(`/events${next.toString() ? `?${next.toString()}` : ""}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={togglePast}
            disabled={!past}
            className={`rounded-md px-3 py-1 ${!past ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={togglePast}
            disabled={past}
            className={`rounded-md px-3 py-1 ${past ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Past
          </button>
        </div>
        <a
          href="/events/new"
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          New event
        </a>
      </div>

      {events.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {past
            ? "No past events recorded."
            : "No upcoming events. Anyone can post one — click 'New event' above."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the events feed page**

Create `src/app/(authed)/events/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { EventFeed } from "@/components/events/event-feed";
import type { EventCardData } from "@/components/events/event-card";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string }>;
}) {
  const { past } = await searchParams;
  const showPast = past === "1";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const query = supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: !showPast });

  const { data: events, error } = showPast
    ? await query.lt("starts_at", nowIso)
    : await query.gte("starts_at", nowIso);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600">
          Could not load events: {error.message}
        </p>
      </main>
    );
  }

  // Build creator-name map: events.created_by → auth.users.id → members.name
  const creatorIds = Array.from(new Set(events.map((e) => e.created_by)));
  const { data: creators } = await supabase
    .from("members")
    .select("user_id, name")
    .in("user_id", creatorIds);
  const creatorNameByUserId = new Map<string, string>();
  for (const c of creators ?? []) {
    if (c.user_id) creatorNameByUserId.set(c.user_id, c.name);
  }

  // Fetch RSVPs for these events to build summaries
  const eventIds = events.map((e) => e.id);
  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("event_id, status, headcount")
    .in("event_id", eventIds);

  const summaryByEvent = new Map<
    string,
    { yes: number; no: number; maybe: number; headcount: number }
  >();
  for (const eId of eventIds) {
    summaryByEvent.set(eId, { yes: 0, no: 0, maybe: 0, headcount: 0 });
  }
  for (const r of rsvps ?? []) {
    const s = summaryByEvent.get(r.event_id);
    if (!s) continue;
    if (r.status === "yes") {
      s.yes++;
      s.headcount += r.headcount ?? 0;
    } else if (r.status === "no") {
      s.no++;
    } else if (r.status === "maybe") {
      s.maybe++;
    }
  }

  const cards: EventCardData[] = events.map((e) => ({
    ...e,
    creator_name: creatorNameByUserId.get(e.created_by) ?? null,
    rsvp_summary: summaryByEvent.get(e.id) ?? {
      yes: 0,
      no: 0,
      maybe: 0,
      headcount: 0,
    },
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      </header>
      <EventFeed events={cards} />
    </main>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `pnpm build`
Expected: `/events` in the route table.

- [ ] **Step 7: Commit**

```bash
git add src/lib/events/format.ts src/components/events src/app/\(authed\)/events/page.tsx
git commit -m "Add /events feed with upcoming/past toggle

Timezone helpers (format.ts) handle the UTC↔Eastern round-trip without
a date library — easternDateInputValue and easternDateFromInput probe
both EDT (-4) and EST (-5) offsets to handle DST correctly. Display
formatters lock timeZone: 'America/New_York'.

Server Component fetches events filtered by past/upcoming, then runs
two follow-up queries: members lookup for creator names (no direct FK
from events → members, see spec §Views), and rsvps for per-event
summaries built into a Map<event_id, summary>. Cards render the
creator name with '(unlisted)' fallback when RLS hides the creator's
members row.

Client EventFeed component owns the past/upcoming toggle via URL state."
```

---

## Task 3: `/events/[id]` detail (read only) + RSVP aggregate

**Files:**
- Create: `src/lib/rsvps/aggregate.ts`
- Create: `src/components/events/event-detail-read.tsx`
- Create: `src/app/(authed)/events/[id]/page.tsx`

After this task, the event detail page renders the event with RSVP aggregate (no interactive controls yet — those land in Task 4).

- [ ] **Step 1: Create the RSVP aggregate helper**

Create `src/lib/rsvps/aggregate.ts`:

```ts
import type { Database } from "@/lib/database.types";

type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];

export type RsvpSummary = {
  yes: number;
  no: number;
  maybe: number;
  headcount: number;
};

export function rsvpSummary(
  rsvps: Pick<RsvpRow, "status" | "headcount">[],
): RsvpSummary {
  const summary: RsvpSummary = { yes: 0, no: 0, maybe: 0, headcount: 0 };
  for (const r of rsvps) {
    if (r.status === "yes") {
      summary.yes++;
      summary.headcount += r.headcount ?? 0;
    } else if (r.status === "no") {
      summary.no++;
    } else if (r.status === "maybe") {
      summary.maybe++;
    }
  }
  return summary;
}
```

- [ ] **Step 2: Create the detail read component**

Create `src/components/events/event-detail-read.tsx`:

```tsx
import { AnnouncementChip } from "@/components/events/announcement-chip";
import { formatEventDateTime, formatEventTime } from "@/lib/events/format";
import { rsvpSummary } from "@/lib/rsvps/aggregate";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];
type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];

export type AttendingHousehold = Pick<
  HouseholdRow,
  "id" | "cottage_name"
> & {
  headcount: number | null;
  status: "yes" | "maybe" | "no";
};

export function EventDetailRead({
  event,
  creatorName,
  rsvps,
  attendingHouseholds,
  canManage,
}: {
  event: EventRow;
  creatorName: string | null;
  rsvps: Pick<RsvpRow, "status" | "headcount">[];
  attendingHouseholds: AttendingHousehold[];
  canManage: boolean;
}) {
  const summary = rsvpSummary(rsvps);

  return (
    <article className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {event.is_announcement ? <AnnouncementChip /> : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {event.title}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Posted by {creatorName ?? "(unlisted)"}
        </p>
      </header>

      <section className="space-y-1">
        <p className="text-sm">
          <span className="font-medium">{formatEventDateTime(event.starts_at)}</span>
          {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
        </p>
        {event.location ? (
          <p className="text-sm text-muted-foreground">{event.location}</p>
        ) : null}
      </section>

      {event.description ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            About
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {event.description}
          </p>
        </section>
      ) : null}

      {event.rsvp_enabled ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            RSVPs
          </h2>
          <p className="mt-1 text-sm">
            {summary.yes} household{summary.yes === 1 ? "" : "s"} attending
            {summary.headcount > 0
              ? ` (${summary.headcount} ${summary.headcount === 1 ? "person" : "people"})`
              : ""}
            {summary.maybe > 0
              ? ` · ${summary.maybe} maybe`
              : ""}
            {summary.no > 0
              ? ` · ${summary.no} declined`
              : ""}
          </p>
          {attendingHouseholds.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {attendingHouseholds.map((h) => (
                <li key={h.id}>
                  {h.cottage_name}
                  {h.headcount ? ` (${h.headcount})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {canManage ? (
        <div className="flex gap-2">
          <a
            href={`/events/${event.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 3: Create the event detail page**

Create `src/app/(authed)/events/[id]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  EventDetailRead,
  type AttendingHousehold,
} from "@/components/events/event-detail-read";

export default async function EventDetailPage({
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

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  // Creator name lookup (no direct FK from events to members)
  const { data: creator } = await supabase
    .from("members")
    .select("name")
    .eq("user_id", event.created_by)
    .maybeSingle();

  // All RSVPs for this event, plus household names for the attending list
  const { data: rsvpsData } = await supabase
    .from("rsvps")
    .select("status, headcount, household_id, households(id, cottage_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const rsvps = (rsvpsData ?? []).map((r) => ({
    status: r.status as "yes" | "no" | "maybe",
    headcount: r.headcount,
  }));

  const attendingHouseholds: AttendingHousehold[] = (rsvpsData ?? [])
    .filter((r) => r.status === "yes")
    .map((r) => ({
      id: r.households?.id ?? r.household_id,
      cottage_name: r.households?.cottage_name ?? "(unknown)",
      headcount: r.headcount,
      status: "yes" as const,
    }));

  const canManage = isAdmin(user) || event.created_by === user.id;

  return (
    <EventDetailRead
      event={event}
      creatorName={creator?.name ?? null}
      rsvps={rsvps}
      attendingHouseholds={attendingHouseholds}
      canManage={canManage}
    />
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: `/events/[id]` in the route table.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rsvps/aggregate.ts src/components/events/event-detail-read.tsx src/app/\(authed\)/events
git commit -m "Add /events/[id] detail read view with RSVP aggregate

Server Component fetches event, creator name (via members lookup on
event.created_by → auth.users.id → members.user_id), and RSVPs joined
to households for the attending list. rsvpSummary helper aggregates
yes/no/maybe counts and the headcount sum.

Interactive RSVP controls (the form to mark your household's status)
land in Task 4. Edit button is gated by canManage (admin or creator)."
```

---

## Task 4: RSVP controls + actions

**Files:**
- Create: `src/lib/rsvps/actions.ts`
- Create: `src/components/events/rsvp-controls.tsx`
- Modify: `src/components/events/event-detail-read.tsx` (render the controls)
- Modify: `src/app/(authed)/events/[id]/page.tsx` (look up viewer's household + own RSVP, pass to read component)

- [ ] **Step 1: Create the RSVP Server Action**

Create `src/lib/rsvps/actions.ts` with a single `setRsvp` action that branches on status. Per the spec, status `"none"` deletes the row; the other three upsert.

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RsvpActionState = { error?: string } | undefined;

function asIntOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function setRsvp(
  _prev: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const event_id = String(formData.get("event_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const headcount = asIntOrNull(formData.get("headcount"));

  if (!event_id) return { error: "Missing event id." };
  if (!["yes", "no", "maybe", "none"].includes(status)) {
    return { error: "Invalid RSVP status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Look up viewer's household.
  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!own?.household_id) {
    return {
      error: "You're not in a household yet — RSVPs are per household.",
    };
  }

  if (status === "none") {
    const { error } = await supabase
      .from("rsvps")
      .delete()
      .eq("event_id", event_id)
      .eq("household_id", own.household_id);
    if (error) return { error: `Could not remove RSVP: ${error.message}` };
  } else {
    const { error } = await supabase.from("rsvps").upsert(
      {
        event_id,
        household_id: own.household_id,
        status,
        headcount: status === "yes" ? headcount : null,
      },
      { onConflict: "event_id,household_id" },
    );
    if (error) return { error: `Could not save RSVP: ${error.message}` };
  }

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/events");
  return undefined;
}
```

- [ ] **Step 2: Create the RSVP controls client component**

Create `src/components/events/rsvp-controls.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { setRsvp, type RsvpActionState } from "@/lib/rsvps/actions";
import { Button } from "@/components/ui/button";

type Status = "yes" | "no" | "maybe";

export function RsvpControls({
  eventId,
  currentStatus,
  currentHeadcount,
}: {
  eventId: string;
  currentStatus: Status | null;
  currentHeadcount: number | null;
}) {
  const [state, action, pending] = useActionState<RsvpActionState, FormData>(
    setRsvp,
    undefined,
  );

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />

      <div className="space-y-1">
        <label
          htmlFor="status"
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Your household
        </label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus ?? "none"}
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="none">Not responded</option>
          <option value="yes">Yes, attending</option>
          <option value="maybe">Maybe</option>
          <option value="no">No, can't make it</option>
        </select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="headcount"
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Headcount (optional)
        </label>
        <input
          id="headcount"
          name="headcount"
          type="number"
          min="0"
          defaultValue={currentHeadcount ?? ""}
          placeholder="How many people"
          className="w-full max-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save RSVP"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Update the event detail read component to render RSVP controls**

Modify `src/components/events/event-detail-read.tsx`. Add the RSVP controls inside the RSVP section. The new file:

```tsx
import { AnnouncementChip } from "@/components/events/announcement-chip";
import { RsvpControls } from "@/components/events/rsvp-controls";
import { formatEventDateTime, formatEventTime } from "@/lib/events/format";
import { rsvpSummary } from "@/lib/rsvps/aggregate";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];
type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];

export type AttendingHousehold = Pick<
  HouseholdRow,
  "id" | "cottage_name"
> & {
  headcount: number | null;
  status: "yes" | "maybe" | "no";
};

export function EventDetailRead({
  event,
  creatorName,
  rsvps,
  attendingHouseholds,
  viewerHouseholdId,
  viewerRsvp,
  canManage,
}: {
  event: EventRow;
  creatorName: string | null;
  rsvps: Pick<RsvpRow, "status" | "headcount">[];
  attendingHouseholds: AttendingHousehold[];
  viewerHouseholdId: string | null;
  viewerRsvp: { status: "yes" | "no" | "maybe"; headcount: number | null } | null;
  canManage: boolean;
}) {
  const summary = rsvpSummary(rsvps);

  return (
    <article className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {event.is_announcement ? <AnnouncementChip /> : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {event.title}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Posted by {creatorName ?? "(unlisted)"}
        </p>
      </header>

      <section className="space-y-1">
        <p className="text-sm">
          <span className="font-medium">{formatEventDateTime(event.starts_at)}</span>
          {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
        </p>
        {event.location ? (
          <p className="text-sm text-muted-foreground">{event.location}</p>
        ) : null}
      </section>

      {event.description ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            About
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {event.description}
          </p>
        </section>
      ) : null}

      {event.rsvp_enabled ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            RSVPs
          </h2>
          <p className="mt-1 text-sm">
            {summary.yes} household{summary.yes === 1 ? "" : "s"} attending
            {summary.headcount > 0
              ? ` (${summary.headcount} ${summary.headcount === 1 ? "person" : "people"})`
              : ""}
            {summary.maybe > 0 ? ` · ${summary.maybe} maybe` : ""}
            {summary.no > 0 ? ` · ${summary.no} declined` : ""}
          </p>
          {attendingHouseholds.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {attendingHouseholds.map((h) => (
                <li key={h.id}>
                  {h.cottage_name}
                  {h.headcount ? ` (${h.headcount})` : ""}
                </li>
              ))}
            </ul>
          ) : null}

          {viewerHouseholdId ? (
            <RsvpControls
              eventId={event.id}
              currentStatus={viewerRsvp?.status ?? null}
              currentHeadcount={viewerRsvp?.headcount ?? null}
            />
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              You&apos;re not in a household — RSVPs are per household.
            </p>
          )}
        </section>
      ) : null}

      {canManage ? (
        <div className="flex gap-2">
          <a
            href={`/events/${event.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Update the page to look up viewer's household + own RSVP**

Modify `src/app/(authed)/events/[id]/page.tsx`. Add a lookup for the viewer's household and their existing RSVP, pass through to the read component:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  EventDetailRead,
  type AttendingHousehold,
} from "@/components/events/event-detail-read";

export default async function EventDetailPage({
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

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: creator } = await supabase
    .from("members")
    .select("name")
    .eq("user_id", event.created_by)
    .maybeSingle();

  const { data: rsvpsData } = await supabase
    .from("rsvps")
    .select("status, headcount, household_id, households(id, cottage_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const rsvps = (rsvpsData ?? []).map((r) => ({
    status: r.status as "yes" | "no" | "maybe",
    headcount: r.headcount,
  }));

  const attendingHouseholds: AttendingHousehold[] = (rsvpsData ?? [])
    .filter((r) => r.status === "yes")
    .map((r) => ({
      id: r.households?.id ?? r.household_id,
      cottage_name: r.households?.cottage_name ?? "(unknown)",
      headcount: r.headcount,
      status: "yes" as const,
    }));

  // Viewer's household + their RSVP for this event
  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const viewerHouseholdId = own?.household_id ?? null;

  let viewerRsvp:
    | { status: "yes" | "no" | "maybe"; headcount: number | null }
    | null = null;
  if (viewerHouseholdId) {
    const ownRsvp = (rsvpsData ?? []).find(
      (r) => r.household_id === viewerHouseholdId,
    );
    if (ownRsvp) {
      viewerRsvp = {
        status: ownRsvp.status as "yes" | "no" | "maybe",
        headcount: ownRsvp.headcount,
      };
    }
  }

  const canManage = isAdmin(user) || event.created_by === user.id;

  return (
    <EventDetailRead
      event={event}
      creatorName={creator?.name ?? null}
      rsvps={rsvps}
      attendingHouseholds={attendingHouseholds}
      viewerHouseholdId={viewerHouseholdId}
      viewerRsvp={viewerRsvp}
      canManage={canManage}
    />
  );
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src/lib/rsvps/actions.ts src/components/events/rsvp-controls.tsx src/components/events/event-detail-read.tsx src/app/\(authed\)/events/\[id\]/page.tsx
git commit -m "Add interactive RSVP controls and setRsvp Server Action

Single form with status select (yes/maybe/no/none) + headcount input.
One Server Action (setRsvp) branches on status: 'none' deletes the
row, the other three upsert. RLS gates to the caller's household
(with admin override). Revalidates the event detail + feed paths so
summaries refresh.

Viewers without a household see a 'RSVPs are per household' note
instead of the form."
```

---

## Task 5: `/events/new` create form + `createEvent` action

**Files:**
- Create: `src/lib/events/actions.ts`
- Create: `src/components/events/event-edit-form.tsx`
- Create: `src/app/(authed)/events/new/page.tsx`

The form component is shared with Task 6's edit flow.

- [ ] **Step 1: Create the Server Actions file with `createEvent`**

Create `src/lib/events/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { easternDateFromInput } from "@/lib/events/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type EventActionState = { error?: string } | undefined;

function asTextOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export async function createEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  const description = asTextOrNull(formData.get("description"));
  const startsAtInput = String(formData.get("starts_at") ?? "");
  const endsAtInput = asTextOrNull(formData.get("ends_at"));
  const location = asTextOrNull(formData.get("location"));
  const rsvpEnabled = formData.get("rsvp_enabled") === "on";
  const isAnnouncement = formData.get("is_announcement") === "on";

  if (!title) return { error: "Title is required." };
  if (!startsAtInput) return { error: "Start date/time is required." };
  if (isAnnouncement && !isAdmin(user)) {
    return { error: "Only admins can post announcements." };
  }

  const starts_at = easternDateFromInput(startsAtInput);
  const ends_at = endsAtInput ? easternDateFromInput(endsAtInput) : null;

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      description,
      starts_at,
      ends_at,
      location,
      is_announcement: isAnnouncement,
      rsvp_enabled: rsvpEnabled,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: `Could not create event: ${error?.message}` };
  }

  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect(`/events/${data.id}`);
}
```

- [ ] **Step 2: Create the shared event edit/create form**

Create `src/components/events/event-edit-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  createEvent,
  type EventActionState,
} from "@/lib/events/actions";
import { easternDateInputValue } from "@/lib/events/format";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export function EventEditForm({
  initial,
  action,
  isAdminViewer,
  submitLabel,
}: {
  initial: Partial<EventRow> | null;
  action: (
    state: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  isAdminViewer: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<
    EventActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial?.description ?? ""}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="starts_at" className="text-sm font-medium">
            Starts (Eastern)
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={
              initial?.starts_at ? easternDateInputValue(initial.starts_at) : ""
            }
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ends_at" className="text-sm font-medium">
            Ends (Eastern, optional)
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={
              initial?.ends_at ? easternDateInputValue(initial.ends_at) : ""
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="location" className="text-sm font-medium">
          Location (optional)
        </label>
        <input
          id="location"
          name="location"
          defaultValue={initial?.location ?? ""}
          placeholder="Lakefront Pavilion"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="rsvp_enabled"
            defaultChecked={initial?.rsvp_enabled ?? true}
            className="h-4 w-4"
          />
          Enable RSVPs
        </label>
      </div>

      {isAdminViewer ? (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_announcement"
              defaultChecked={initial?.is_announcement ?? false}
              className="h-4 w-4"
            />
            Mark as announcement
          </label>
        </div>
      ) : null}

      {state?.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {initial?.id ? (
          <a
            href={`/events/${initial.id}`}
            className="text-sm text-muted-foreground underline underline-offset-2 self-center"
          >
            Cancel
          </a>
        ) : (
          <a
            href="/events"
            className="text-sm text-muted-foreground underline underline-offset-2 self-center"
          >
            Cancel
          </a>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create the new-event page**

Create `src/app/(authed)/events/new/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { EventEditForm } from "@/components/events/event-edit-form";
import { createEvent } from "@/lib/events/actions";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <EventEditForm
      initial={null}
      action={createEvent}
      isAdminViewer={isAdmin(user)}
      submitLabel="Create event"
    />
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: `/events/new` in route table.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/actions.ts src/components/events/event-edit-form.tsx src/app/\(authed\)/events/new
git commit -m "Add /events/new create form and createEvent Server Action

Shared EventEditForm component used by both create and edit flows;
the page passes the right action + initial values. Date inputs use
type=datetime-local with values converted to/from Eastern via the
format helpers. is_announcement checkbox hidden for non-admins.

createEvent enforces the same admin-only rule on is_announcement
that RLS does — app-layer check fires first for a friendly error.
Successful create redirects to the new event's detail page."
```

---

## Task 6: `/events/[id]?edit=1` edit flow + `updateEvent`

**Files:**
- Modify: `src/lib/events/actions.ts` (add `updateEvent`)
- Modify: `src/app/(authed)/events/[id]/page.tsx` (route to edit form on `?edit=1`)

- [ ] **Step 1: Add `updateEvent` to the actions file**

Append to `src/lib/events/actions.ts`:

```ts
export async function updateEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing event id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Fetch the existing event to enforce ownership at the app layer.
  const { data: existing } = await supabase
    .from("events")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Event not found." };

  const adminViewer = isAdmin(user);
  if (!adminViewer && existing.created_by !== user.id) {
    return { error: "Not authorized." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = asTextOrNull(formData.get("description"));
  const startsAtInput = String(formData.get("starts_at") ?? "");
  const endsAtInput = asTextOrNull(formData.get("ends_at"));
  const location = asTextOrNull(formData.get("location"));
  const rsvpEnabled = formData.get("rsvp_enabled") === "on";
  const isAnnouncement = formData.get("is_announcement") === "on";

  if (!title) return { error: "Title is required." };
  if (!startsAtInput) return { error: "Start date/time is required." };
  if (isAnnouncement && !adminViewer) {
    return { error: "Only admins can mark events as announcements." };
  }

  const starts_at = easternDateFromInput(startsAtInput);
  const ends_at = endsAtInput ? easternDateFromInput(endsAtInput) : null;

  const { error } = await supabase
    .from("events")
    .update({
      title,
      description,
      starts_at,
      ends_at,
      location,
      is_announcement: isAnnouncement,
      rsvp_enabled: rsvpEnabled,
    })
    .eq("id", id);
  if (error) return { error: `Could not save event: ${error.message}` };

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect(`/events/${id}`);
}
```

- [ ] **Step 2: Add edit routing to the detail page**

Modify `src/app/(authed)/events/[id]/page.tsx`. Replace the page with this version that branches on `?edit=1`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  EventDetailRead,
  type AttendingHousehold,
} from "@/components/events/event-detail-read";
import { EventEditForm } from "@/components/events/event-edit-form";
import { updateEvent } from "@/lib/events/actions";

export default async function EventDetailPage({
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

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const adminViewer = isAdmin(user);
  const canManage = adminViewer || event.created_by === user.id;

  if (edit === "1") {
    if (!canManage) redirect(`/events/${id}`);
    return (
      <EventEditForm
        initial={event}
        action={updateEvent}
        isAdminViewer={adminViewer}
        submitLabel="Save changes"
      />
    );
  }

  // Read view
  const { data: creator } = await supabase
    .from("members")
    .select("name")
    .eq("user_id", event.created_by)
    .maybeSingle();

  const { data: rsvpsData } = await supabase
    .from("rsvps")
    .select("status, headcount, household_id, households(id, cottage_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const rsvps = (rsvpsData ?? []).map((r) => ({
    status: r.status as "yes" | "no" | "maybe",
    headcount: r.headcount,
  }));

  const attendingHouseholds: AttendingHousehold[] = (rsvpsData ?? [])
    .filter((r) => r.status === "yes")
    .map((r) => ({
      id: r.households?.id ?? r.household_id,
      cottage_name: r.households?.cottage_name ?? "(unknown)",
      headcount: r.headcount,
      status: "yes" as const,
    }));

  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const viewerHouseholdId = own?.household_id ?? null;

  let viewerRsvp:
    | { status: "yes" | "no" | "maybe"; headcount: number | null }
    | null = null;
  if (viewerHouseholdId) {
    const ownRsvp = (rsvpsData ?? []).find(
      (r) => r.household_id === viewerHouseholdId,
    );
    if (ownRsvp) {
      viewerRsvp = {
        status: ownRsvp.status as "yes" | "no" | "maybe",
        headcount: ownRsvp.headcount,
      };
    }
  }

  return (
    <EventDetailRead
      event={event}
      creatorName={creator?.name ?? null}
      rsvps={rsvps}
      attendingHouseholds={attendingHouseholds}
      viewerHouseholdId={viewerHouseholdId}
      viewerRsvp={viewerRsvp}
      canManage={canManage}
    />
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/events/actions.ts src/app/\(authed\)/events/\[id\]/page.tsx
git commit -m "Add /events/[id]?edit=1 edit flow with updateEvent action

updateEvent verifies ownership at the app layer (creator or admin)
before issuing the UPDATE — RLS is still the authoritative gate, but
this short-circuits with a friendly error. is_announcement transitions
to true require admin (mirrors createEvent + RLS WITH CHECK).

The detail page branches on ?edit=1 → renders EventEditForm with the
existing event as initial. Unauthorized edit attempts redirect to the
read view. Successful save redirects back via the action."
```

---

## Task 7: Delete event + delete button

**Files:**
- Modify: `src/lib/events/actions.ts` (add `deleteEvent`)
- Create: `src/components/events/event-delete-button.tsx`
- Modify: `src/components/events/event-detail-read.tsx` (render the delete button when `canManage`)

- [ ] **Step 1: Add `deleteEvent` to the actions file**

Append to `src/lib/events/actions.ts`:

```ts
export async function deleteEvent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS will authoritatively block unauthorized deletes; this is the
  // app-layer fast-path. We don't return errors from delete because the
  // client form uses confirm() pre-submit and then redirects unconditionally.
  await supabase.from("events").delete().eq("id", id);

  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect("/events");
}
```

- [ ] **Step 2: Create the delete button client component**

Create `src/components/events/event-delete-button.tsx`:

```tsx
"use client";

import { deleteEvent } from "@/lib/events/actions";
import { Button } from "@/components/ui/button";

export function EventDeleteButton({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  return (
    <form
      action={deleteEvent}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${eventTitle}"? This will also remove all RSVPs and cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      <Button type="submit" variant="ghost" size="sm">
        Delete
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Render the delete button in the detail read component**

Modify `src/components/events/event-detail-read.tsx`. In the final `canManage` block, render the delete button alongside Edit:

Replace this block:

```tsx
      {canManage ? (
        <div className="flex gap-2">
          <a
            href={`/events/${event.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        </div>
      ) : null}
```

With:

```tsx
      {canManage ? (
        <div className="flex items-center gap-2">
          <a
            href={`/events/${event.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
          <EventDeleteButton eventId={event.id} eventTitle={event.title} />
        </div>
      ) : null}
```

Add the import at the top:

```tsx
import { EventDeleteButton } from "@/components/events/event-delete-button";
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/actions.ts src/components/events/event-delete-button.tsx src/components/events/event-detail-read.tsx
git commit -m "Add event delete with browser confirm() dialog

deleteEvent server action doesn't return errors — RLS authoritatively
gates the delete, and the client-side confirm() dialog handles the
'are you sure' UX. On success, revalidates /events + /calendar and
redirects to the feed.

The button only renders for canManage viewers (creator or admin)."
```

---

## Task 8: Announcement flag (admin-only + visual chip)

**Files:**
- Verify: announcement checkbox in `event-edit-form.tsx` is admin-gated (from Task 5)
- Verify: `AnnouncementChip` renders in `event-card.tsx` (from Task 2) and `event-detail-read.tsx` (from Task 3)
- Possibly: tighten any remaining gaps

This task mostly validates that the announcement plumbing already in place from earlier tasks is complete; it adds nothing materially new. If everything checks out, the only action is the commit acknowledging the feature is shipped.

- [ ] **Step 1: Inspect the existing code**

Run:
```bash
grep -n "is_announcement" src/components/events/event-edit-form.tsx src/components/events/event-card.tsx src/components/events/event-detail-read.tsx src/lib/events/actions.ts
```

Confirm:
- `event-edit-form.tsx` only renders the announcement checkbox when `isAdminViewer` is true (Task 5 added this).
- `event-card.tsx` renders `<AnnouncementChip />` when `event.is_announcement` is true (Task 2 added this).
- `event-detail-read.tsx` renders the chip in its header (Task 3 added this).
- `createEvent` and `updateEvent` return `{ error: "Only admins..." }` when a non-admin tries to flag (Tasks 5 + 6 added this).

If any of these is missing, fix it inline. The expected state is that all four are already correct.

- [ ] **Step 2: Verify build**

Run: `pnpm build`

- [ ] **Step 3: Commit an empty marker if no changes; otherwise commit the fixes**

If no fixes were needed (the expected case), skip this task's commit — Phase 3 doesn't need a no-op commit. Move on to Task 9.

If a fix was needed, commit it with a descriptive message that identifies the gap.

---

## Task 9: `/calendar` month grid

**Files:**
- Create: `src/components/calendar/event-chip.tsx`
- Create: `src/components/calendar/calendar-grid.tsx`
- Create: `src/app/(authed)/calendar/page.tsx`

- [ ] **Step 1: Create the calendar event chip**

Create `src/components/calendar/event-chip.tsx`:

```tsx
import { formatEventTime } from "@/lib/events/format";

export function CalendarEventChip({
  id,
  title,
  starts_at,
  is_announcement,
}: {
  id: string;
  title: string;
  starts_at: string;
  is_announcement: boolean;
}) {
  const tone = is_announcement
    ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
    : "bg-sky-100 text-sky-900 hover:bg-sky-200";
  return (
    <a
      href={`/events/${id}`}
      title={`${formatEventTime(starts_at)} — ${title}`}
      className={`block truncate rounded px-1 py-0.5 text-xs ${tone}`}
    >
      {formatEventTime(starts_at)} {title}
    </a>
  );
}
```

- [ ] **Step 2: Create the calendar grid client component**

Create `src/components/calendar/calendar-grid.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarEventChip } from "@/components/calendar/event-chip";

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  is_announcement: boolean;
};

type Cell = {
  iso: string; // YYYY-MM-DD in Eastern
  inMonth: boolean;
  events: CalendarEvent[];
};

const TIMEZONE = "America/New_York";

function easternIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseMonthParam(raw: string | null): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  const isoNow = easternIso(now);
  const [y, m] = isoNow.split("-").map(Number);
  return { year: y, month: m };
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function buildCells(
  year: number,
  month: number,
  events: CalendarEvent[],
): Cell[] {
  // First-of-month at noon UTC to avoid TZ edge cases.
  const firstUtc = new Date(Date.UTC(year, month - 1, 1, 12));
  // Eastern weekday for the 1st (0 = Sunday)
  const firstWeekday = new Date(
    firstUtc.toLocaleString("en-US", { timeZone: TIMEZONE }),
  ).getDay();

  const cells: Cell[] = [];
  // 42 cells = 6 weeks
  const start = new Date(firstUtc);
  start.setUTCDate(1 - firstWeekday);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const day = easternIso(new Date(e.starts_at));
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(e);
  }

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = easternIso(d);
    const cellMonth = Number(iso.split("-")[1]);
    cells.push({
      iso,
      inMonth: cellMonth === month,
      events: eventsByDay.get(iso) ?? [],
    });
  }

  return cells;
}

export function CalendarGrid({
  monthParam,
  events,
}: {
  monthParam: string | null;
  events: CalendarEvent[];
}) {
  const router = useRouter();
  const { year, month } = parseMonthParam(monthParam);

  const cells = useMemo(
    () => buildCells(year, month, events),
    [year, month, events],
  );

  function go(delta: -1 | 0 | 1) {
    if (delta === 0) {
      router.push("/calendar");
      return;
    }
    const next = new Date(Date.UTC(year, month - 1 + delta, 15));
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    router.push(`/calendar?month=${y}-${m}`);
  }

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {monthLabel(year, month)}
        </h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => go(-1)}
            className="rounded-md border border-input px-3 py-1 hover:bg-muted"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(0)}
            className="rounded-md border border-input px-3 py-1 hover:bg-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-md border border-input px-3 py-1 hover:bg-muted"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border">
        {dayHeaders.map((d) => (
          <div
            key={d}
            className="bg-background px-2 py-1 text-center text-xs uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const day = Number(cell.iso.split("-")[2]);
          const visible = cell.events.slice(0, 3);
          const overflow = cell.events.length - visible.length;
          return (
            <div
              key={cell.iso}
              className={`min-h-[5rem] bg-background p-1 ${cell.inMonth ? "" : "opacity-40"}`}
            >
              <div className="text-right text-xs text-muted-foreground">
                {day}
              </div>
              <div className="mt-1 space-y-0.5">
                {visible.map((e) => (
                  <CalendarEventChip
                    key={e.id}
                    id={e.id}
                    title={e.title}
                    starts_at={e.starts_at}
                    is_announcement={e.is_announcement}
                  />
                ))}
                {overflow > 0 ? (
                  <a
                    href={`/events?day=${cell.iso}`}
                    className="block truncate rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    +{overflow} more
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the calendar page**

Create `src/app/(authed)/calendar/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { CalendarGrid } from "@/components/calendar/calendar-grid";

const TIMEZONE = "America/New_York";

function monthRangeUtc(
  monthParam: string | null,
): { startUtcIso: string; endUtcIso: string } {
  let year: number;
  let month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const parts = monthParam.split("-").map(Number);
    year = parts[0];
    month = parts[1];
  } else {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    year = Number(parts.find((p) => p.type === "year")?.value);
    month = Number(parts.find((p) => p.type === "month")?.value);
  }

  // Bracket generously — the grid shows neighboring days from adjacent months.
  // Fetch from the month before to the month after to be safe.
  const startUtcIso = new Date(
    Date.UTC(year, month - 2, 1),
  ).toISOString();
  const endUtcIso = new Date(
    Date.UTC(year, month + 1, 1),
  ).toISOString();
  return { startUtcIso, endUtcIso };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { startUtcIso, endUtcIso } = monthRangeUtc(month ?? null);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, is_announcement")
    .gte("starts_at", startUtcIso)
    .lt("starts_at", endUtcIso)
    .order("starts_at", { ascending: true });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <CalendarGrid monthParam={month ?? null} events={events ?? []} />
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: `/calendar` in route table.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar src/app/\(authed\)/calendar
git commit -m "Add /calendar month grid view

Server Component fetches events bracketing the displayed month (the
prior + current + next month, since the grid shows neighboring days).
Client CalendarGrid handles month navigation via URL state (?month=YYYY-MM)
and Sunday-first 7×6 grid layout.

Each day cell shows up to 3 event chips; '+N more' links to
/events?day=YYYY-MM-DD (the date-filtered feed, added in Task 11).
Announcements get a warmer chip color from regular events."
```

---

## Task 10: Add Events + Calendar to the authed shell nav

**Files:**
- Modify: `src/components/layout/authed-shell.tsx`

- [ ] **Step 1: Add the two nav links**

Replace `src/components/layout/authed-shell.tsx` with:

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
              <a href="/events" className="hover:text-foreground">
                Events
              </a>
              <a href="/calendar" className="hover:text-foreground">
                Calendar
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
git commit -m "Add Events and Calendar links to the authed shell nav"
```

---

## Task 11: Polish — `?day=YYYY-MM-DD` filter, dashboard link

**Files:**
- Modify: `src/app/(authed)/events/page.tsx` (add `?day=...` filter)
- Modify: `src/app/(authed)/dashboard/page.tsx` (mention events)

- [ ] **Step 1: Add `?day=YYYY-MM-DD` filter to the feed page**

Modify `src/app/(authed)/events/page.tsx`. Change the searchParams type to include `day`, and replace the query branching block. The relevant changes:

Old signature:

```tsx
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string }>;
}) {
  const { past } = await searchParams;
  const showPast = past === "1";
```

New signature and query logic:

```tsx
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string; day?: string }>;
}) {
  const { past, day } = await searchParams;
  const showPast = past === "1";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // When ?day=YYYY-MM-DD is set, ignore past/upcoming and filter to that
  // single Eastern day. Bracket: midnight Eastern → midnight Eastern next day.
  let query = supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: !showPast });

  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, mo, d] = day.split("-").map(Number);
    // Eastern midnight is UTC midnight + 4 or 5 (DST). Bracket conservatively.
    const start = new Date(Date.UTC(y, mo - 1, d, 0)).toISOString();
    const end = new Date(Date.UTC(y, mo - 1, d + 2, 0)).toISOString();
    query = query.gte("starts_at", start).lt("starts_at", end);
  } else if (showPast) {
    query = query.lt("starts_at", nowIso);
  } else {
    query = query.gte("starts_at", nowIso);
  }

  const { data: events, error } = await query;
```

(The rest of the page — creator-name + RSVP-summary lookups + render — stays unchanged.)

- [ ] **Step 2: Add an Events link to the dashboard**

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
          Browse the{" "}
          <a href="/directory" className="underline underline-offset-2">
            directory
          </a>
          , check{" "}
          <a href="/events" className="underline underline-offset-2">
            upcoming events
          </a>
          , or open the{" "}
          <a href="/calendar" className="underline underline-offset-2">
            calendar
          </a>
          . Map, photos, and documents are on the way.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Manual run of the full Phase 3 test plan**

Walk through every bullet in the spec's "Testing" section + the "Permissions matrix" cases. Fix any failures before committing.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authed\)/events/page.tsx src/app/\(authed\)/dashboard/page.tsx
git commit -m "Filter /events by ?day= and link dashboard to events + calendar

The calendar's '+N more' overflow already pointed at /events?day=YYYY-MM-DD;
the feed page now actually filters on that param (events whose starts_at
falls within that Eastern day). When ?day is set, it overrides the
past/upcoming toggle.

Dashboard mentions the directory, events feed, and calendar so first-time
members have three obvious destinations after sign-in."
```

---

## Phase 3 wrap-up

- [ ] **Run the full spec test plan** (per the design doc's testing checklist).
- [ ] **Push to origin:** `git push`
- [ ] **Append to `PLANNING.md` §9** the three Phase 3 decisions:
  - Per-household RSVPs with optional headcount (deviation from §5.2's per-member sketch); two narrow RLS surfaces enforce it.
  - Timezone hardcoded America/New_York; inline `easternDate*` helpers in `src/lib/events/format.ts`, no date library dependency.
  - Calendar is month-grid-only; the feed IS the agenda view.

Phase 3 is complete when:
- All 10 implementation commits + 1 polish commit are on `main`.
- Every checkbox in the spec's test plan passes.
- An admin can post an announcement and a member can RSVP for their household; the count and headcount aggregate correctly on the feed and detail pages.
- The calendar shows the same events for the current month with appropriate color-coding.
