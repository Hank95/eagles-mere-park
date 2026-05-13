-- The original Phase 3 rsvps RLS policies didn't check events.rsvp_enabled,
-- so a direct API POST could insert an RSVP on an event with RSVPs disabled.
-- The UI hides controls but RLS is the authoritative gate; this closes the gap.
--
-- AGENTS.md flags cross-table RLS subqueries as needing confirmation. Approved
-- here because per-event settings cannot be encoded as a JWT claim, so the
-- subquery is the only correct mechanism.

drop policy "rsvps_insert" on public.rsvps;
drop policy "rsvps_update" on public.rsvps;

create policy "rsvps_insert"
on public.rsvps for insert
to authenticated
with check (
  (
    household_id = public.current_user_household_id()
    or public.is_admin()
  )
  and exists (
    select 1 from public.events
    where events.id = event_id
      and events.rsvp_enabled = true
  )
);

create policy "rsvps_update"
on public.rsvps for update
to authenticated
using (
  household_id = public.current_user_household_id()
  or public.is_admin()
)
with check (
  (
    household_id = public.current_user_household_id()
    or public.is_admin()
  )
  and exists (
    select 1 from public.events
    where events.id = event_id
      and events.rsvp_enabled = true
  )
);
