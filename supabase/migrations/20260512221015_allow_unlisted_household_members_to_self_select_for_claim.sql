-- members_select from Phase 0 lets a viewer see their own row, same-household
-- siblings, and members of non-unlisted households. The claim helper does a
-- pre-UPDATE SELECT to find the row to link; for a member of an unlisted
-- household with user_id IS NULL, none of those arms match. The SELECT
-- returns null, so the matching members_claim UPDATE policy never gets to
-- fire. Member of an unlisted household → permanently stuck at /no-household.
--
-- Mirror the members_claim shape: let a signed-in user SELECT an unlinked
-- row whose email matches their auth email. Narrow enough that it doesn't
-- broaden visibility of any claimed row.

create policy "members_self_select_for_claim"
on public.members for select
to authenticated
using (
  user_id is null
  and lower(email) = lower(auth.jwt() ->> 'email')
);
