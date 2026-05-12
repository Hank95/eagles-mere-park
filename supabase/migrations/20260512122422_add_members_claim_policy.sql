-- Allow a signed-in user to claim a pre-seeded members row by setting user_id
-- to their own auth.uid(), but only if the row is currently unclaimed AND its
-- email matches the caller's auth email.
--
-- Phase 0's members_update policy required (is_admin OR user_id = auth.uid()),
-- which evaluates to NULL on rows where user_id IS NULL (because NULL = X is
-- NULL in SQL). That silently blocked the Phase 2 claim flow for every
-- non-admin first-time member. This policy provides the narrow exception.
--
-- The WITH CHECK clause enforces that the only permitted write is setting
-- user_id to the caller's own UID — they cannot, for example, set user_id
-- to someone else's UID.

create policy "members_claim"
on public.members for update
to authenticated
using (
  user_id is null
  and lower(email) = lower(auth.jwt() ->> 'email')
)
with check (
  user_id = auth.uid()
);
