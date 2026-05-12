# Phase 3: Events & Announcements — design

**Status:** approved 2026-05-12
**Phase:** 3 of 7 (see `PLANNING.md` §6)
**Depends on:** Phase 0 (schema + RLS helpers), Phase 1 (auth + `(authed)` shell), Phase 2 (households + members; `current_user_household_id()` SECURITY DEFINER helper).

## Summary

Phase 3 makes Eagles Mere Park *active*: members can post events, RSVP for their households, see what's upcoming on a chronological feed and a month-grid calendar, and admins can flag posts as announcements. It introduces two new tables (`events`, `rsvps`), one Server Action file per resource, and two new sections of the authed app. Past events stay reachable as a community archive.

## Scope

### In scope

- Migration creating `events` and `rsvps` tables with full RLS coverage
- `/events` feed page: upcoming by default, `?past=1` for the archive, with creator-name + RSVP-summary on each card
- `/events/new` create form (any authed user can create; only admins can flag as announcement)
- `/events/[id]` detail page: read view by default, `?edit=1` toggles to the inline edit form for the creator or admin (mirrors the Phase 2 households pattern)
- Inline delete button on the detail page (creator or admin) with browser `confirm()` dialog
- RSVP controls per household with optional headcount; `upsert` + `delete` Server Actions
- Announcement flag: admin-only, visual distinction in the feed and detail
- `/calendar` month grid view: 7-column Sun–Sat grid, event chips per day, "+N more" overflow links to a date-filtered feed, prev/next month navigation, URL state `?month=YYYY-MM`
- "Events" and "Calendar" nav links in the authed shell

### Out of scope (and where it goes)

| Out | Where instead |
|---|---|
| Photo upload on events | Phase 5 (photos & documents) builds Supabase Storage; event photos plug in then. Phase 3 leaves `photo_url` nullable. |
| Weekly digest email | Phase 6 (polish + email) — Resend wiring. The data the digest needs (upcoming events, recent announcements) is in place after Phase 3. |
| Recurring events | Not on the roadmap. Community events are one-offs; duplicate creation is fine. |
| Comments / replies on events | Not in `PLANNING.md`. Members coordinate via email or porches per §1.3. |
| iCal / Google Calendar export | Defer. Easy to add post-launch if requested. |
| Past-event RSVP lock | Past events can still have their RSVPs edited (someone might be correcting "actually we did come"). Not a security gap. |
| Per-member RSVP | Considered and rejected — see D2. |
| Recurring/repeat events | Not now. |

## Design decisions (Phase-3-specific)

These supplement `PLANNING.md` §9. If anything proves wrong during implementation, append to §9.

- **D1. Timezone is hardcoded America/New_York for display, UTC in storage.** Eagles Mere is in Eastern Time and members are either physically there or thinking about being there. A member checking the site from abroad still wants "July 4 at 4pm" in EM-local. `timestamptz` columns store with offset; `Intl.DateTimeFormat(..., { timeZone: 'America/New_York' })` renders. Single-tenant, single-location project; no per-user TZ preference.
- **D2. RSVP shape is per-household with optional headcount, not per-member.** PLANNING.md §5.2 sketched per-member (`rsvps(event_id, member_id)`); reconsidered because most community events are 50+ attendees and "Pendleton family is in, bringing 4" is the natural unit. Granular per-member RSVPs would add clicks for every multi-person household; the spec's "shows count + list of attendees" reads cleanly with household-level aggregation. Schema becomes `rsvps(event_id, household_id, status, headcount)`.
- **D3. Inline edit on `/events/[id]?edit=1` mirrors Phase 2's household pattern.** Same URL for read and edit; admin edit-any is a one-line `canManage` conditional rather than a separate route tree.
- **D4. Delete uses a browser `confirm()` dialog rather than a confirmation page.** One fewer route to maintain. The action posts back to the same page; failure shows an inline error.
- **D5. Announcement is a boolean flag on `events`, not a separate table.** PLANNING.md §3.1 explicitly says "same fields as events but with an announcement flag for visual distinction." Two tables would be over-engineered for the one-bit difference.
- **D6. `events.created_by` references `auth.users(id)` with `on delete restrict`.** A member's auth user could theoretically be deleted; their event history should not vanish. `restrict` blocks deletion until an admin reassigns or removes the events. Display "creator name" by joining to `members` via the auth user id; fall back to "(former member)" if no matching row.
- **D7. The calendar view shows a month at a time only, no week/agenda toggles.** The feed IS the agenda view (chronological list). The calendar's value is the at-a-glance month overview. Adding a week view would duplicate the feed and complicate the URL state.
- **D8. Feed shows upcoming by default with a `?past=1` toggle, not a unified stream.** Members most commonly want "what's next." The archive is one click away.

## Permissions matrix

| Action | Member (household) | Admin (with or without household) |
|---|---|---|
| View feed / calendar / detail | ✓ | ✓ |
| Create regular event | ✓ | ✓ |
| Create announcement | ✗ | ✓ |
| Edit / delete own event | ✓ | ✓ (it's still their own) |
| Edit / delete any event | ✗ | ✓ |
| RSVP for own household | ✓ | ✓ if admin has a household; otherwise n/a |
| Override RSVP for any household | ✗ | ✓ |

Edge case: an admin with no `members` row (`hhpendleton@gmail.com` in dev) cannot RSVP as themselves because there's no household to RSVP from. They can still create events and admin-override RSVPs for other households. Acceptable.

## Data model

```
events
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

rsvps
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  status text not null check (status in ('yes','no','maybe')),
  headcount integer check (headcount is null or headcount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, household_id)
```

Indexes:
- `events_starts_at_idx` on `events(starts_at)` for feed/calendar window queries
- `rsvps_event_id_idx` on `rsvps(event_id)` for "who's attending" lookups
- Unique `(event_id, household_id)` doubles as a lookup index for "this household's RSVP to this event"

Triggers:
- `set_updated_at` on both tables (the helper already exists from Phase 0)

## RLS

| Table | Op | Policy summary |
|---|---|---|
| `events` | SELECT | Any authenticated user |
| `events` | INSERT | Any authenticated user. WITH CHECK requires `is_admin()` when `is_announcement = true` |
| `events` | UPDATE | `created_by = auth.uid() OR is_admin()`. WITH CHECK additionally requires `is_admin()` if `is_announcement = true` in the new row |
| `events` | DELETE | `created_by = auth.uid() OR is_admin()` |
| `rsvps` | SELECT | Any authenticated user (RSVPs are community-visible) |
| `rsvps` | INSERT | `household_id = current_user_household_id() OR is_admin()` |
| `rsvps` | UPDATE | same as INSERT |
| `rsvps` | DELETE | same as INSERT |

The `is_announcement` check in events INSERT/UPDATE WITH CHECK is the key admin gate. A non-admin trying to flip the flag would have RLS silently block the write (similar pattern to Phase 2's lessons — the Server Action validates first for friendly errors).

## Routes

```
src/app/(authed)/
  events/
    page.tsx              # feed
    new/page.tsx          # create form (member or admin)
    [id]/page.tsx         # detail: read or edit via ?edit=1
  calendar/page.tsx       # month grid; ?month=YYYY-MM
```

`?day=YYYY-MM-DD` on `/events` filters the feed to a single day (used by calendar overflow links). Same page, additional URL state.

## File structure

```
src/
  app/(authed)/events/{page,new,[id]}/...
  app/(authed)/calendar/page.tsx
  components/
    events/
      event-feed.tsx           # client; upcoming/past toggle + cards
      event-card.tsx           # row in the feed
      event-detail-read.tsx
      event-edit-form.tsx
      event-create-form.tsx    # subset of edit form; create-specific copy
      rsvp-controls.tsx        # client; status buttons + headcount input
      event-delete-button.tsx  # client; window.confirm() before submit
      announcement-chip.tsx    # tiny presentational
    calendar/
      calendar-grid.tsx        # client; month navigation
      event-chip.tsx           # used inside day cells
    layout/
      authed-shell.tsx         # MODIFIED: add Events + Calendar links
  lib/
    events/
      actions.ts               # createEvent, updateEvent, deleteEvent
      format.ts                # formatEastern, eventDateLabel, isUpcoming
    rsvps/
      actions.ts               # upsertRsvp, removeRsvp
      aggregate.ts             # rsvpSummary(rsvps): { yes, no, maybe, headcount }
supabase/migrations/
  <timestamp>_create_events_and_rsvps.sql   # timestamp filled by `supabase migration new`
```

## Views

### `/events` feed

- Header: page title "Events", a "New event" button, and an "Upcoming / Past" toggle.
- Query: two queries, joined in the Server Component (Supabase's nested select can't traverse `events → auth.users → members` because there's no direct FK from `events` to `members`):
  1. `events.select('*')` with the appropriate `starts_at` filter and ordering.
  2. `members.select('user_id, name').in('user_id', <unique creator ids>)` to build a `Map<user_id, name>` for display.
- For an unlisted-household creator whose row is filtered out by `members_select` RLS for the current viewer, the name lookup returns nothing — fall back to "(unlisted)" on the card. Acceptable: an unlisted creator gets a privacy-consistent placeholder.
- Card content: announcement chip (if applicable) · title · formatted date/time/location · creator name (or "(unlisted)") · RSVP summary ("3 yes, 12 people · 1 maybe") · click navigates to detail.
- Empty states:
  - Upcoming: "No upcoming events. Anyone can post one — click 'New event' above."
  - Past: "No past events recorded."
- `?day=YYYY-MM-DD` filters to events whose `starts_at` falls on that day (in Eastern), regardless of past/future toggle.

### `/calendar` month grid

- 7-column Sun–Sat grid, 6 rows.
- Day cells: date number in the corner; up to 3 event chips below; "+N more" link to `/events?day=YYYY-MM-DD` when 4+ events.
- Announcements get a distinct chip color (e.g., warmer / muted-orange) from regular events.
- Header: prev/next month buttons, "Today" button, month-year label.
- URL state `?month=YYYY-MM` (default: current month in Eastern).
- Click an event chip → `/events/[id]`.

### `/events/[id]` detail (read)

- Header: announcement chip + title + creator name.
- Date/time: formatted Eastern, with the start time prominent and an end time if present.
- Location: text, if set.
- Description: `whitespace-pre-line` for paragraph breaks.
- RSVP section (when `rsvp_enabled`):
  - For a member with a household: a single form with a `status` select (Yes / Maybe / No / Not responded), a `headcount` number input (shown when status is Yes), and a Save button. The form posts to a single Server Action that branches: `status === "Not responded"` → call `removeRsvp`; otherwise → call `upsertRsvp` with the chosen status and headcount.
  - Below: aggregate ("3 households / 12 people attending; 1 maybe; 1 declined") and a list of attending households (cottage name + headcount if set).
- Edit + Delete buttons rendered when `canManage = is_admin || created_by === auth.uid()`.

### `/events/[id]?edit=1` and `/events/new`

Both use the same form component (`event-edit-form.tsx`) with different submit actions and copy. Fields:
- Title (required)
- Description (textarea)
- Starts at (datetime-local input; submitted as ISO string)
- Ends at (datetime-local, optional)
- Location (text, optional)
- RSVP enabled (checkbox, default true)
- Announcement (checkbox, **disabled and hidden** for non-admins)

Date inputs are `type="datetime-local"` for native UX. The client renders them in Eastern (using the `value` attribute formatted in EM time); the Server Action parses with `Date.parse` and stores UTC.

## Server Actions

### `src/lib/events/actions.ts`

- `createEvent(prev, formData) → { error?, eventId? }` — validates required fields, returns auth-not-signed-in error, checks `is_announcement` admin claim if set, inserts, `redirect('/events/[newId]')`.
- `updateEvent(prev, formData) → { error? }` — same shape as Phase 2's `updateHousehold`: app-layer auth check (`created_by === auth.uid() || isAdmin`), required-fields validation, `is_announcement` change requires admin, UPDATE, `revalidatePath('/events/[id]')`, `revalidatePath('/events')`, `revalidatePath('/calendar')`, redirect to detail.
- `deleteEvent(formData) → never` — takes id, RLS-gated DELETE, revalidate same three paths, `redirect('/events')`. Called from a client `<form>` whose submit handler first runs `window.confirm()`.

### `src/lib/rsvps/actions.ts`

- `upsertRsvp(prev, formData) → { error? }` — takes `event_id`, `status`, optional `headcount`. Determines `household_id` from the signed-in user's `current_user_household_id()` (or, for admins setting another household's RSVP, an explicit `household_id` field). Uses `supabase.from('rsvps').upsert(..., { onConflict: 'event_id,household_id' })`. Revalidates `/events/[id]`.
- `removeRsvp(formData) → { error? }` — takes `event_id`, deletes the row for the caller's household. Revalidates `/events/[id]`.

## RSVP aggregate

`src/lib/rsvps/aggregate.ts` exposes:

```ts
export type RsvpSummary = {
  yes: number;
  no: number;
  maybe: number;
  headcount: number; // sum of headcount among 'yes' rows (treats null as 0)
};

export function rsvpSummary(rsvps: Pick<Rsvp, "status" | "headcount">[]): RsvpSummary;
```

Used by feed cards and detail page to render the "3 households / 12 people" text consistently.

## Timezone handling

- All `timestamptz` columns store UTC (Supabase default).
- Display: `formatEastern(date: string | Date): string` in `src/lib/events/format.ts`. Uses `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ... })`.
- Form `datetime-local` inputs are inherently TZ-less. To render an existing event in Eastern for editing, the form receives an ISO string and reformats it for the input via `Intl.DateTimeFormat` parts; on submit, the Server Action parses the local-time string by appending the Eastern offset.
- DST is handled correctly by `Intl.DateTimeFormat` automatically.
- A single helper `easternDateInputValue(date)` constructs the `value` attribute the input expects, and a parallel `easternDateFromInput(inputString)` converts the submitted string to UTC for storage.

## Error handling

- Form errors surface inline (same pattern as Phase 2).
- Required-field errors come from server-side validation and HTML `required`.
- An admin-required action (announcement, edit-any) by a non-admin returns `{ error: "Not authorized." }`; RLS would also block but the app-layer check fires first.
- Delete failures are rare; if `confirm()` returns true and the action errors, the page reloads with an inline error.
- Past-event RSVP changes are allowed.

## Testing

No automated suite (continuing Phases 1–2 precedent). Manual verification per task in the implementation plan; the full plan adds a wrap-up checklist.

## Build sequence

1. Migration: `events` + `rsvps` tables + RLS + indexes + triggers; regenerate types.
2. `/events` feed (upcoming default; `?past=1` toggle); empty states.
3. `/events/[id]` detail (read only, no RSVP yet).
4. RSVP controls + `upsertRsvp` / `removeRsvp` actions; aggregate helper.
5. `/events/new` form + `createEvent` action.
6. `/events/[id]?edit=1` form + `updateEvent` action.
7. `deleteEvent` action + delete button with `confirm()` dialog.
8. Announcement flag: admin-only checkbox, visual chip in feed/card/detail.
9. `/calendar` month grid + navigation; overflow link to `/events?day=YYYY-MM-DD`.
10. Nav: add "Events" and "Calendar" to `AuthedShell`.
11. Polish: timezone helpers consolidated, RSVP edge cases, "past" toggle URL state.

## Open items deferred to later phases

- Event photo upload (Phase 5)
- Weekly digest email (Phase 6 with Resend)
- iCal / Google Calendar export (post-launch if requested)
- Per-member granular RSVPs (rejected; revisit only if a specific event type demands it)
- Recurring events (rejected; community events are one-offs)
- Reminders / push notifications (V2 per PLANNING.md §3.2 — only if members ask)
