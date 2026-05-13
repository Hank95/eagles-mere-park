-- Phase 4: cottages
-- See docs/superpowers/specs/2026-05-13-phase-4-map-design.md
--
-- cottages bridges the illustrated map to the directory. The SVG asset has
-- <g data-cottage-id="..."> markers; each marker maps to one row here via
-- the unique map_element_id column. Cottages may be unlinked (vacant).

create table public.cottages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year_built integer,
  history_text text,
  household_id uuid references public.households(id) on delete set null,
  map_element_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cottages_household_id_idx
  on public.cottages(household_id)
  where household_id is not null;

create trigger cottages_set_updated_at
before update on public.cottages
for each row execute function public.set_updated_at();

alter table public.cottages enable row level security;

-- Cottages are visible to any authed user (the map is community-facing
-- once the real illustration ships; admin gate on /map is enforced in
-- the app layer, not RLS, so admins can hand-craft routes that probe
-- the data while members never see /map).
create policy "cottages_select"
on public.cottages for select
to authenticated
using (true);

create policy "cottages_insert"
on public.cottages for insert
to authenticated
with check (public.is_admin());

create policy "cottages_update"
on public.cottages for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "cottages_delete"
on public.cottages for delete
to authenticated
using (public.is_admin());
