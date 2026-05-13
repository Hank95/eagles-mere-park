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
