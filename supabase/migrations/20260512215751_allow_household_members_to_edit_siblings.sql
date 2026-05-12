-- Extend members_update so a non-admin authenticated user can update any row
-- whose household_id matches their own. Without this, a household member can
-- only update their own members row — they can't fix typos in their spouse's
-- contact info because the spouse's user_id differs from auth.uid().
--
-- The matching households_update policy already lets a household member update
-- household-level fields via `id = public.current_user_household_id()`. This
-- brings members_update into parity.
--
-- DROP + recreate is the cleanest way to amend a USING clause; Phase 1's
-- decision-log records the original is_admin/own-row design as still valid —
-- this just adds the household-sibling case.

drop policy "members_update" on public.members;

create policy "members_update"
on public.members for update
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or household_id = public.current_user_household_id()
)
with check (
  public.is_admin()
  or user_id = auth.uid()
  or household_id = public.current_user_household_id()
);