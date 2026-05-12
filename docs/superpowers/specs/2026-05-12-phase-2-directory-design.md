# Phase 2: Directory — design

**Status:** approved 2026-05-12
**Phase:** 2 of 7 (see `PLANNING.md` §6)
**Depends on:** Phase 0 (initial schema with `households` + `members` tables and RLS), Phase 1 (auth, `(authed)` route group, `/auth/callback` Route Handler, `invite-member.ts` script).

## Summary

Phase 2 turns the app from "you can sign in" into "you can see and edit the directory." It links the auth identity to the pre-seeded member row (the bridge Phase 1 deliberately left for Phase 2), adds a compact list view of all visible households, a detail page with privacy-aware rendering, and an inline edit flow on the same URL. Admins see the Edit button on every household; members see it only on their own.

The directory is the spine of the site (PLANNING.md §3.1). Get this phase right, and every later feature (events, map, photos, documents) plugs into a coherent identity layer.

## Scope

### In scope

- **Claim flow**: on first signed-in request, link `members.user_id` to the row whose `email` matches `auth.users.email`. Silent, idempotent, runs from the authed layout.
- **No-household landing**: members signed in but unmatched (and not admin) see a "you're not in any household yet — contact an admin" page instead of the directory.
- **`/directory`**: compact list page, one row per visible household, with thumbnail (initials avatar), cottage name, family last name(s), arrival year, year-round/seasonal chip, and chevron. Client-side search/filter/sort over a server-fetched dataset.
- **`/households/<id>`**: read-only detail page rendering cottage info + bio + family members, honoring per-field privacy toggles for non-owner viewers.
- **Inline edit on the same URL** (`?edit=1`): renders an editable form pre-populated with current data. Same fields as read view, plus per-field privacy toggles. Save calls a Server Action, returns to read view via `revalidatePath` + `redirect`.
- **Per-field privacy toggles**: `email_is_public`, `phone_is_public`, `address_is_public` on each member's row. Editable in the form. Read view filters fields accordingly.
- **Admin edit-any**: admin sees the Edit button on every household, not just their own. Otherwise identical flow. RLS already enforces this server-side.
- **Nav update**: add a "Directory" link to the authed shell header.

### Out of scope (and where it goes)

| Out | Where instead |
|---|---|
| Photo upload (cottage_photo_url, family_photo_url) | Phase 5 (photos & documents) builds the Supabase Storage pipeline; the household edit flow gains "Upload photo" affordances then. Phase 2 uses initials-on-color avatars. |
| Add / remove members from a household via UI | Members are still added only via `scripts/invite-member.ts`. Phase 2's edit form fills in details for existing rows. |
| Cottage history fields, archival photos, owner timeline | Phase 4 (the map) and Phase 4's "Cottage history pages" V2 item. |
| Bulk data import | PLANNING.md §7.2 — done separately when there's real data to import; not on the critical path. |
| Audit log of admin edits | No `audit_log` table yet; defer until there's a real reason. |
| `pg_trgm` fuzzy search | Server fetches all ~150 households once; client-side filter is plenty fast. Future upgrade if the count crosses ~1000. |
| Avatar customization (upload, edit) | See "Photo upload" above. |

## Design decisions (Phase-2-specific)

These supplement `PLANNING.md` §9. If anything proves wrong during implementation, append to §9 — don't edit this file.

- **D1. Claim runs in the authed layout, not in `/auth/callback`.** Idempotent per-request linking means a member is never signed-in-but-unlinked, even if their email was changed in `auth.users` after invitation. Cost is one indexed lookup per signed-in request, which short-circuits on the common "already linked" case.
- **D2. Silent claim, no UI prompt.** PLANNING.md's "warm, curated" tone is best served by "it just works." A confirmation step makes signing in feel transactional. If a mismatch ever happens (rare — admin would have to invite the wrong email AND the wrong recipient would have to accept), an admin can fix manually via a future tool.
- **D3. Inline edit on the same URL** (`?edit=1`) rather than `/households/<id>/edit`. Same UI for member-editing-own and admin-editing-any. One URL, one mental model.
- **D4. Server-fetch the entire directory once, filter client-side.** At ~150 households the round-trip latency of per-keystroke server queries outweighs the bundle cost of holding the list in memory. Filtering is purely a UI concern.
- **D5. No photo upload in this phase.** Avatar slot uses initials-on-color (deterministic mapping from family last name to color). Phase 5 owns Supabase Storage.
- **D6. Add/remove members deferred.** The edit form fills in detail for existing rows; new members come in via `invite-member.ts`. Keeps Phase 2 scope tight; adds family-management UI complexity to a phase where it isn't needed.
- **D7. Sequenced updates, not transactional.** Editing a household + N members issues separate UPDATE statements. Mid-save failure leaves a partial state. Acceptable at this scale; if it bites, swap to a Postgres function / RPC for atomicity.

## Access matrix

This matches the RLS policies from Phase 0's `20260511230231_initial_schema.sql`. The UI layer mirrors it; RLS catches any UI mistake server-side.

| Viewer | `/directory` | `/households/<id>` (read) | `/households/<id>?edit=1` |
|---|---|---|---|
| Logged-out | redirect to `/login?next=…` | redirect to `/login` | redirect to `/login` |
| Member, household linked | All non-unlisted households + own | Same (privacy filters applied) | Own household only |
| Member, no household (rare) | redirect to `/no-household` | 404 / redirect (non-admins can't see) | 404 |
| Admin (with or without household) | All households, including unlisted | All | Any |

## File structure

```
src/
  app/
    (authed)/
      layout.tsx                            # MODIFIED — runs claim helper after getUser()
      no-household/page.tsx                 # NEW — friendly landing for unlinked non-admins
      directory/page.tsx                    # NEW — server-fetches households, passes to client list
      households/[id]/page.tsx              # NEW — read OR edit based on ?edit=1
  components/
    directory/
      directory-list.tsx                    # NEW — client; search/filter/sort + row renderer
      household-row.tsx                     # NEW — single row (avatar + name + family + year + chip)
      initials-avatar.tsx                   # NEW — deterministic-color avatar from a name
    households/
      household-detail-read.tsx             # NEW — read-only view, privacy-filtered
      household-edit-form.tsx               # NEW — client; full edit form
      member-edit-row.tsx                   # NEW — single member's fields with privacy toggles
    layout/
      authed-shell.tsx                      # MODIFIED — add "Directory" nav link
  lib/
    members/
      claim.ts                              # NEW — claimMemberRowIfNeeded(supabase, user)
    households/
      actions.ts                            # NEW — updateHousehold Server Action
      visibility.ts                         # NEW — helpers to filter member fields by viewer permissions
```

Notes:
- `claim.ts` is a pure function that takes a Supabase server client + user object and performs the lookup/link. Testable in isolation (when we have tests).
- `visibility.ts` centralizes the per-field privacy rules so they don't drift between read and edit components.
- `actions.ts` is a single Server Action file scoped to households. Keeps `lib/auth/actions.ts` focused on auth.

## Claim flow

In `src/app/(authed)/layout.tsx`, after `auth.getUser()` returns a user:

```ts
import { claimMemberRowIfNeeded } from "@/lib/members/claim";
// ...
const { data: { user } } = await supabase.auth.getUser();
if (!user) { /* existing redirect to /login?next= */ }
await claimMemberRowIfNeeded(supabase, user);
```

The helper itself:

```ts
// src/lib/members/claim.ts
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

  // Slow path: try to link by email.
  if (!user.email) return; // OAuth without email — skip
  const { data: match } = await supabase
    .from("members")
    .select("id")
    .ilike("email", user.email)
    .is("user_id", null)
    .maybeSingle();
  if (!match) return; // no matching pre-seeded row — render no-household state

  await supabase
    .from("members")
    .update({ user_id: user.id })
    .eq("id", match.id);
}
```

Notes:
- Uses `.ilike` for case-insensitive email match (Supabase normalizes on storage, but defensive).
- `.is("user_id", null)` guard prevents a hostile actor with a re-used invited email from snatching an already-claimed row.
- Failure modes are silent — the helper never throws back to the layout. Worst case is "unlinked," which the page-level UX handles.

After the claim attempts, the layout renders `AuthedShell` as before. Pages decide what to do based on the resulting state:
- `/directory` redirects to `/no-household` if the viewer has no member row AND isn't admin.
- `/households/<id>` 404s for non-admin viewers who don't share the household (handled implicitly by RLS — an unfindable id returns null).

## Routes

### `/directory` (`src/app/(authed)/directory/page.tsx`)

Server Component:
1. Awaits Supabase server client.
2. Reads `(await supabase.auth.getUser()).data.user`. If admin (claim from JWT) OR has a member row → fetch all households visible per RLS plus the members joined. If no row and not admin → `redirect("/no-household")`.
3. Renders `<DirectoryList households={...} />` (client component).

Households are fetched with a join to members so we can render family last names without an N+1 query:

```ts
const { data: households } = await supabase
  .from("households")
  .select("id, cottage_name, arrival_year, is_year_round, is_unlisted, members(name, role)")
  .order("cottage_name");
```

### `/households/[id]` (`src/app/(authed)/households/[id]/page.tsx`)

Server Component, async, awaits `params: Promise<{ id: string }>` (Next 16):

1. Fetches the household + its members. If null (not found OR RLS blocked) → `notFound()` (404).
2. Determines edit eligibility: admin claim from JWT OR `members.user_id = auth.uid()` is in this household.
3. Reads `searchParams: Promise<{ edit?: string }>`. If `edit === "1"` AND viewer can edit → render `<HouseholdEditForm initial={data} />`. Otherwise render `<HouseholdDetailRead data={data} canEdit={...} />`.

The read component shows or hides each field based on the viewer:
- Field is always visible if: viewer is admin, OR viewer is a member of this household, OR `<field>_is_public` is true.
- Otherwise field is omitted from the rendered card (no "private" placeholder — just gone).

### `/no-household` (`src/app/(authed)/no-household/page.tsx`)

Static-ish content: "We don't have you down in any household yet. Reach out to a Park board member to get added." Includes a "Sign out" affordance (Server Action already exists).

## Server Action: `updateHousehold`

File: `src/lib/households/actions.ts`

```ts
"use server";

export type UpdateHouseholdState = { error?: string; saved?: boolean } | undefined;

export async function updateHousehold(
  _prev: UpdateHouseholdState,
  formData: FormData,
): Promise<UpdateHouseholdState> {
  // 1. Parse household id from formData.get("id") — required.
  // 2. Verify viewer can edit (admin claim, OR household_id matches current_user_household_id).
  //    If not authorized → return { error: "Not authorized." }
  // 3. Build household update from formData fields.
  // 4. Build per-member updates from formData (fields prefixed `member.<id>.<field>`).
  // 5. Issue UPDATE households + UPDATE members (sequenced).
  // 6. On any error → return { error: <message> }.
  // 7. On success → revalidatePath(`/households/${id}`) + revalidatePath('/directory') + redirect to read view.
}
```

The form encodes per-member fields with a prefix so a single `FormData` post handles the household + N member rows. The action parses the prefix structure.

Authorization check uses an RLS-side helper to avoid app-layer logic:
- Admin: `auth.jwt()->'app_metadata'->>'is_admin'` is `true`.
- Owner: `current_user_household_id()` (already a SECURITY DEFINER function from Phase 0) equals the household id being edited.

If both fail: action returns an error, the underlying UPDATE would also fail due to RLS.

## Privacy in detail

The read view filters fields per the per-field flags. The edit form shows all fields and a toggle next to each contact field that the viewer controls:
- For a member's own row (member_user_id = auth.uid()): toggles are editable; they decide what's public.
- For an admin editing someone else's row: toggles are editable but a small note reads "the member controls this field's visibility."
- For non-admin viewers of someone else's row: edit form not accessible.

Read view uses `src/lib/households/visibility.ts`:

```ts
type ViewerContext = { id: string; isAdmin: boolean; householdId: string | null };

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
    name: member.name,                                          // always visible to authenticated viewers
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

The address lives on `households.street_address`, not on `members`. But the privacy flag for it (`address_is_public`) is per-member. So address visibility is decided at the household level by checking any-member-public: if any member of the household has `address_is_public = true`, the household's address is shown to outside viewers. Admins and same-household viewers always see it. (Alternative — hide the whole address unless majority public — feels paternalistic. Any-public is the warmer default.)

## Search / filter / sort

Implementation lives in `DirectoryList` (client component):
- State: `query` (string), `seasonFilter` ("all" | "year-round" | "seasonal"), `sortBy` ("cottage_name" | "family_name" | "arrival_year").
- Search is a client-side `String#includes` over each row's searchable fields (cottage_name, family last names from joined members). Case-insensitive.
- Filter is a simple predicate on `is_year_round`.
- Sort is a comparator on the chosen field; family_name uses the first member's last name as proxy.
- All three are applied to the in-memory array on every render. At 150 rows, this is instant.

Persistence: search/filter/sort state lives in the URL via `useSearchParams` + `router.replace` so links are shareable and back/forward works.

## Error handling

- Unauthorized edit attempt → action returns `{ error: "Not authorized." }`, form shows error banner. RLS also blocks the underlying write — defense in depth.
- Save error (network, RLS deny, validation) → action returns `{ error: <message> }`. Form preserves the user's edits.
- Field validation (email format, year is integer, year is plausible) → server-side in the action; surfaces as field-level error text.
- Empty search results → list shows "No households match that search." copy.
- Missing thumbnail → initials-on-color avatar.
- Saving while signed out (session expired mid-edit) → action's auth check fails → user is redirected to `/login?next=/households/<id>?edit=1` so they bounce back into the edit after signing in again.

## Testing (manual verification)

No automated test suite for Phase 2 (continuing Phase 1's precedent). Test plan:

- [ ] **Claim flow happy path.** Use `pnpm invite-member <new-email> --name "Test Two" --new-household "Test Cottage Two"`. Open the invite email, set password, sign in. Verify in Supabase dashboard SQL editor that `members.user_id` is set for that row.
- [ ] **Claim flow no-match.** Sign in as `hhpendleton@gmail.com` (admin, no member row). Visit `/directory` → admins see directory. Sign in as a non-admin email with no member row (create one via dashboard) → `/no-household` page renders.
- [ ] **Directory list.** Loaded as a member: see all non-unlisted households + own. As admin: see all including unlisted (visually marked? — see TBD below).
- [ ] **Directory search.** Type "Pines" → only matching households visible. Clear search → all back.
- [ ] **Directory filter.** Choose "Year-round" → only year-round visible. Clear → all back.
- [ ] **Directory sort.** Choose each of cottage / family / year → ordering changes appropriately.
- [ ] **Directory URL state.** Search/filter/sort state persists in URL; reload preserves it; browser back/forward navigates between states.
- [ ] **Detail read (own household).** All fields visible (the viewer is a member). Edit button visible.
- [ ] **Detail read (other household, public fields).** Only public contact fields visible. Edit button hidden.
- [ ] **Detail read (other household, no public fields).** Member name + role visible; contact fields hidden. Edit button hidden.
- [ ] **Detail read (admin viewing any household).** All fields visible. Edit button visible.
- [ ] **Inline edit (own household).** Edit button → form. Change a field, save. Read view reflects the change.
- [ ] **Inline edit privacy toggle.** Flip `email_is_public` for a member to false. Save. Other members no longer see that email in the read view.
- [ ] **Inline edit (admin editing other household).** Same flow. Save updates the row.
- [ ] **Unauthorized edit attempt.** Member visits `/households/<other-id>?edit=1` → either redirects (cleanest) or shows "not authorized" if the page renders.
- [ ] **Session expired mid-edit.** Manually clear cookies in devtools, then save → redirected to `/login?next=...`. Sign in → land back on the edit form.

### Unlisted indicator for admins

Admins see unlisted households in the directory list with a small lock icon adjacent to the cottage name and a faint italic on the row. Gives a visible cue that the row is sensitive data not normally surfaced. The lock icon is also rendered in the detail page header for unlisted households (any viewer who can see it).

## Build sequence

1. **Claim helper + no-household page + layout integration.** Adds `claim.ts`, `/no-household`, hooks it into `(authed)/layout.tsx`. Verify manually with a test user.
2. **`/directory` Server Component (no UI yet)** — fetches and renders raw data, just to confirm the data layer works.
3. **`DirectoryList` client component (list shape, no search/filter/sort).** Compact list, initials avatar, chevron, click → `/households/<id>`.
4. **Add "Directory" nav link** to the authed shell. Sign-in flow now lands a member on `/dashboard` and they can navigate to the directory.
5. **Search/filter/sort** with URL persistence.
6. **`/households/[id]` read view** — privacy-aware rendering. Use `visibility.ts`.
7. **Edit toggle + form scaffold.** `?edit=1` renders `HouseholdEditForm` for authorized viewers. No save yet.
8. **`updateHousehold` Server Action.** Wire form to it. Sequenced updates. `revalidatePath` + `redirect` on save.
9. **Privacy toggles in the edit form.** Round-trip through the action.
10. **Admin edit-any.** One-line conditional on the Edit button. RLS already gates the write.
11. **Polish.** Empty states, "no results," field-level validation errors, sign-out edge case, unlisted indicator for admins.

## Open items deferred to later phases

- Photo upload for cottages and families (Phase 5)
- Add/remove members from a household via UI (Phase 2.5 or wherever it surfaces as needed)
- Audit log of admin edits (when the table exists)
- Cottage-history fields (Phase 4)
- `pg_trgm` fuzzy search (when row count exceeds ~1000)
- Bulk import script for migrating existing community directory data (PLANNING.md §7.2)
