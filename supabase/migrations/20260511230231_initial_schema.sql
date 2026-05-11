-- Initial schema: households, members, and the JWT-based admin helper.
-- Matches PLANNING.md §5.2 and the §9 decisions on admin role + privacy defaults.
--
-- Ordering note: Postgres validates function bodies at CREATE time, so any
-- helper that references a table must be created AFTER the table exists.
-- That's why the order below is: cheap helpers → tables → table-dependent
-- helpers → indexes → triggers → RLS + policies.

-- ============================================================================
-- Helpers without table dependencies
-- ============================================================================

-- Admin check reads the `app_metadata.is_admin` claim from the JWT.
-- `app_metadata` is server-set via the service-role API and cannot be
-- self-elevated by the client. See PLANNING.md §9.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Tables
-- ============================================================================

create table public.households (
  id uuid primary key default gen_random_uuid(),
  cottage_name text not null,
  street_address text,
  arrival_year integer,
  is_year_round boolean not null default false,
  bio text,
  cottage_photo_url text,
  family_photo_url text,
  is_unlisted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  email_is_public boolean not null default false,
  phone_is_public boolean not null default false,
  address_is_public boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Helpers that depend on the tables above
-- ============================================================================

-- Returns the household_id of the currently authenticated user, or null.
-- SECURITY DEFINER so RLS doesn't recurse when policies reference this helper.
create or replace function public.current_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.members
  where user_id = auth.uid()
  limit 1;
$$;

-- ============================================================================
-- Indexes
-- ============================================================================

create index members_household_id_idx on public.members(household_id);

-- A given auth user belongs to at most one member row.
create unique index members_user_id_idx
on public.members(user_id)
where user_id is not null;

-- ============================================================================
-- Triggers
-- ============================================================================

create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.households enable row level security;
alter table public.members enable row level security;

-- households ------------------------------------------------------------------

-- Visible to any authenticated user unless unlisted; own household and admins
-- always see it.
create policy "households_select"
on public.households for select
to authenticated
using (
  is_unlisted = false
  or public.is_admin()
  or id = public.current_user_household_id()
);

-- Own household members or admins can update.
create policy "households_update"
on public.households for update
to authenticated
using (
  public.is_admin()
  or id = public.current_user_household_id()
)
with check (
  public.is_admin()
  or id = public.current_user_household_id()
);

-- Admin-only create and delete (households are seeded by admin via data import
-- per PLANNING.md §7.2).
create policy "households_insert"
on public.households for insert
to authenticated
with check (public.is_admin());

create policy "households_delete"
on public.households for delete
to authenticated
using (public.is_admin());

-- members ---------------------------------------------------------------------

-- Visible to: self, admins, own household, or anyone authed if the member's
-- household is not unlisted. The subquery on households piggybacks on
-- households' own SELECT policy, which does not reference members — no cycle.
create policy "members_select"
on public.members for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or household_id = public.current_user_household_id()
  or exists (
    select 1 from public.households
    where households.id = members.household_id
      and households.is_unlisted = false
  )
);

-- Members edit their own row; admins edit any.
create policy "members_update"
on public.members for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

-- Admin-only create and delete. Member rows are seeded by admin during data
-- import; invited users claim their row by linking `user_id` to their
-- `auth.users.id` once they accept the invite.
create policy "members_insert"
on public.members for insert
to authenticated
with check (public.is_admin());

create policy "members_delete"
on public.members for delete
to authenticated
using (public.is_admin());
