# Phase 4: The Map (infrastructure first) — design

**Status:** approved 2026-05-13
**Phase:** 4 of 7 (see `PLANNING.md` §6)
**Depends on:** Phase 0 (schema + RLS helpers), Phase 1 (auth + `(authed)` shell), Phase 2 (households + linked-cottage UI surface), Phase 3 (no direct dependency, but `cottages` follows the same RLS conventions established there).

## Summary

Phase 4 builds the technical infrastructure for the map — the cottages table, the SVG host component, hover and click interactions, the popover and bottom-sheet UI, pan and zoom, and admin authoring — using a placeholder SVG of labeled rectangles. The placeholder is gated to admins only; members see a "coming soon" page until the real illustration arrives.

When the illustration is in hand, the swap is single-file: replace the placeholder SVG, update the cottages table with new `map_element_id` rows via the existing CLI script, remove the admin gate, add the nav link. All the interaction logic is already proven.

This phase honors PLANNING.md §6's warning ("a mediocre map damages the project's identity more than a missing map does") by gating the placeholder. It also derisks the eventual launch — when the illustration drops in, the only unknown is the asset itself, not the code around it.

## Scope

### In scope

- `cottages` table (per `PLANNING.md` §5.2) + RLS + types regeneration
- `/map` route with admin-only gate; non-admins see a "coming soon" panel
- `CottageMap` client component wrapping a placeholder SVG, with pan/zoom via `panzoom` (anvaka, ~10kb gzipped)
- Placeholder SVG with ~15 labeled rectangles, each a `<g data-cottage-id="...">`
- Click handler that opens a popover on desktop / bottom sheet on mobile, picked via viewport media query
- Popover content for every viewer: cottage name, linked household (with `/households/<id>` link), year built, history snippet
- Admin-only inline edit affordance in the popover: link a household, set year built, edit history
- Server Action `updateCottage` (admin-gated; RLS authoritative)
- CLI script `scripts/seed-cottages.ts` to bulk-create cottage rows from a JSON list of `{ map_element_id, name }` pairs. Idempotent. Used twice: once for the placeholder, once for the real illustration.
- "Coming soon" UX for non-admin visitors to `/map`

### Out of scope (and where it goes)

| Out | Where instead |
|---|---|
| The real illustration | External — commissioned or DIY per PLANNING.md §4.1. Drops in as a single-file swap when ready. |
| Cottage photos | Phase 5 owns Supabase Storage. The popover shows photos as `cottage_photo_url`/`family_photo_url` from the linked household once Phase 5 wires uploads. |
| Filter overlays (year-round / new families / built-before) | V2 per `PLANNING.md` §3.1. |
| Long-form cottage history pages with timelines | V2 per `PLANNING.md` §3.2. |
| Map link in the authed shell nav | Added when the illustration ships. |
| Reconciling `cottages.name` vs `households.cottage_name` | They coexist for now. The map uses `cottages.name`; the directory uses `households.cottage_name`. Resolve if it becomes confusing. |
| Bulk-management admin page (`/admin/cottages` table view) | Defer until the in-popover editing proves insufficient. |
| `createCottage` and `deleteCottage` Server Actions | The CLI script handles creation; cottages aren't manually deleted (the SVG is the source of truth). |

## Design decisions (Phase-4-specific)

These supplement `PLANNING.md` §9. If anything proves wrong during implementation, append to §9 — don't edit this file.

- **D1. Build infrastructure now with a placeholder SVG; gate to admins.** Lets us prove the interaction layer (pan/zoom, popover/sheet, admin edits) before the illustration arrives. PLANNING.md §6 says "ship without it if needed and add it when the illustration is right"; gating the placeholder honors that — members see no map at all until quality is right.
- **D2. Pan/zoom via `panzoom` (anvaka), not `react-svg-pan-zoom` or hand-rolled.** Smallest viable dependency that handles touch, pinch, mouse, momentum, bounds — well-tested, ~10kb gzipped. The hand-rolled alternative is 50-80 lines of subtle pointer-event handling for no real gain at this scale.
- **D3. Popover on desktop, bottom sheet on mobile.** Picked via `useMediaQuery('(min-width: 768px)')` on the client. The mobile sheet is a custom 30-line slide-up `<div>` (not vaul/shadcn `Drawer`) — the behavior is constrained enough that the dep isn't worth ~15kb. `useMediaQuery` is a small custom hook at `src/lib/use-media-query.ts` returning a boolean from `window.matchMedia`, with sane SSR defaults.
- **D4. Admin authoring happens inside the popover, not on a separate `/admin/cottages` page.** Click cottage → see its current state → expand "Edit" → change linked household / year built / history → save. Discoverable; the admin's mental model is "I'm looking at this cottage on the map." A dedicated admin page would be added later only if bulk editing is needed.
- **D5. `map_element_id` is the contract between the SVG and the database.** Whenever the asset changes (placeholder → real illustration, or a real-illustration revision), an admin runs the `seed-cottages.ts` script with an updated JSON list. The script is idempotent and INSERTs only missing rows.
- **D6. `cottages.name` and `households.cottage_name` coexist.** Different semantic — the cottage's name belongs to the building (historical); the household's `cottage_name` belongs to the family's directory entry (current self-description). They'll typically match, but allowing divergence handles edge cases like an old cottage marker "Lookout" being currently owned by a family that lists their household as "The Smith Place."
- **D7. No `createCottage` / `deleteCottage` Server Actions.** The SVG illustration is the source of truth for which cottages exist; the cottages table mirrors it. A new cottage on the map means the illustrator updated the SVG, the admin updates the JSON list, and the seed script INSERTs. Deletion follows the same path (rare; would require the illustrator removing the cottage from the SVG, then admin running a cleanup).

## Data model

```sql
create table public.cottages (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                          -- e.g., "The Pines"
  year_built integer,
  history_text text,
  household_id uuid references public.households(id) on delete set null,
  map_element_id text not null unique,                         -- matches SVG data-cottage-id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cottages_household_id_idx
  on public.cottages(household_id)
  where household_id is not null;

create trigger cottages_set_updated_at
before update on public.cottages
for each row execute function public.set_updated_at();
```

The `set_updated_at` helper is from Phase 0; `households(id)` is the Phase 0 FK.

`map_element_id` is `unique` so the SVG → database mapping is 1:1. `household_id` has a partial index to support the common "find cottage for this household" lookup without bloating the index with vacant cottages.

## RLS

| Op | Policy | Rationale |
|---|---|---|
| SELECT | Any authenticated user | Cottages are visible to all members on the map; visibility of who-lives-where is gated separately by `households_select` |
| INSERT | `public.is_admin()` only | Cottages are seeded from the SVG via admin CLI; members never create them |
| UPDATE | `public.is_admin()` only | Linking a household, setting year built, editing history are all admin actions |
| DELETE | `public.is_admin()` only | Rare — only when the SVG itself loses a cottage |

## File structure

```
src/
  app/(authed)/
    map/page.tsx                       # admin gate; renders CottageMap or "coming soon"
  components/
    map/
      cottage-map.tsx                  # client; wraps SVG, sets up panzoom, owns selected-cottage state
      placeholder-svg.tsx              # server; inline SVG with placeholder rectangles
      cottage-detail-panel.tsx         # client; picks popover or sheet by viewport
      cottage-popover.tsx              # client; desktop floating popover
      cottage-sheet.tsx                # client; mobile bottom sheet
      cottage-edit-fields.tsx          # client; admin-only inline edit form inside popover/sheet
  lib/
    cottages/
      actions.ts                       # updateCottage server action
      placeholder.ts                   # array of { map_element_id, name } for the placeholder seed
scripts/
  seed-cottages.ts                     # bulk-insert from placeholder.ts or a passed JSON file
supabase/migrations/
  <timestamp>_create_cottages.sql      # filename filled by `supabase migration new`
```

## Gating strategy

`/map/page.tsx` reads the current user and computes `isAdmin(user)`:

```tsx
if (!isAdmin(user)) {
  return <ComingSoonPanel />;
}
return <CottageMap />;
```

`ComingSoonPanel` is a small static section: "The illustrated map of Eagles Mere Park is coming soon. We're working with an illustrator on something worthy of the place. Check back."

The authed shell nav does NOT get a Map link in this phase. Admins reach `/map` by typing the URL or following a link in admin docs.

When the illustration ships, the swap is:
1. Replace `placeholder-svg.tsx` with the real SVG component.
2. Update `placeholder.ts` to the real list of cottages; run `pnpm seed-cottages` to insert the new rows.
3. Remove the `isAdmin(user)` gate (or change it to a feature-flag check if rollout is staged).
4. Add the Map link to the authed shell nav.

That's a small follow-up phase — likely 1-3 commits — not a full re-implementation.

## `CottageMap` client component

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import panzoom from "panzoom";
import { PlaceholderSvg } from "./placeholder-svg";
import { CottageDetailPanel } from "./cottage-detail-panel";

export function CottageMap({ /* ...props */ }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const instance = panzoom(svgRef.current, {
      maxZoom: 5,
      minZoom: 0.5,
      bounds: true,
      boundsPadding: 0.1,
    });
    return () => instance.dispose();
  }, []);

  function handleClick(e: React.MouseEvent<SVGElement>) {
    const target = (e.target as Element).closest("[data-cottage-id]");
    if (!target) return;
    const id = target.getAttribute("data-cottage-id");
    if (id) setSelectedId(id);
  }

  return (
    <>
      <div className="h-[80vh] w-full overflow-hidden rounded-md border border-border bg-muted/20">
        <PlaceholderSvg ref={svgRef} onClick={handleClick} />
      </div>
      {selectedId ? (
        <CottageDetailPanel
          mapElementId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}
```

Notes:
- Click events bubble up to the SVG container. We use `closest('[data-cottage-id]')` to find the cottage `<g>` (since hits may land on inner shapes).
- `panzoom` doesn't block click events on child elements; clicks still fire normally.
- Selecting a cottage opens a panel; the panel fetches details by `map_element_id` (it joins to `cottages` + the linked `households` for family last names + dropdown options for admin editing).

## `CottageDetailPanel` (desktop popover / mobile sheet)

A thin wrapper that picks the right presentation:

```tsx
"use client";

import { useMediaQuery } from "@/lib/use-media-query"; // tiny custom hook
import { CottagePopover } from "./cottage-popover";
import { CottageSheet } from "./cottage-sheet";

export function CottageDetailPanel({ mapElementId, onClose }: ...) {
  const desktop = useMediaQuery("(min-width: 768px)");
  if (desktop) {
    return <CottagePopover mapElementId={mapElementId} onClose={onClose} />;
  }
  return <CottageSheet mapElementId={mapElementId} onClose={onClose} />;
}
```

Both children take the same props and render the same content (the `CottageEditFields` for admins, the read view for members). The difference is purely presentational.

### Read view (every viewer)

- Cottage name (large)
- Linked household: family last names + link to `/households/<id>`, OR "Currently vacant" if `household_id` is null
- Year built (if set): "Built 1923"
- History snippet (if set): up to ~3 lines, truncated

### Edit view (admins only, behind an "Edit" toggle)

- Household dropdown — populated with all households (cottage_name + family last names); includes "(none)" to vacate
- Year built — number input
- History text — textarea, up to ~500 chars
- Save button (calls `updateCottage` Server Action)

The edit view's data fetch (the household dropdown list) runs server-side via the page-level fetch, not inside the popover (avoids a roundtrip per popover open). The popover receives `householdOptions` as a prop.

## Server Action: `updateCottage`

In `src/lib/cottages/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { revalidatePath } from "next/cache";

export type UpdateCottageState = { error?: string; saved?: boolean } | undefined;

function asTextOrNull(value: FormDataEntryValue | null): string | null { /* ... */ }
function asIntOrNull(value: FormDataEntryValue | null): number | null { /* ... */ }

export async function updateCottage(
  _prev: UpdateCottageState,
  formData: FormData,
): Promise<UpdateCottageState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing cottage id." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!isAdmin(user)) return { error: "Not authorized." };

  const household_id = asTextOrNull(formData.get("household_id"));   // null = vacate
  const year_built = asIntOrNull(formData.get("year_built"));
  const history_text = asTextOrNull(formData.get("history_text"));

  const { error } = await supabase
    .from("cottages")
    .update({ household_id, year_built, history_text })
    .eq("id", id);
  if (error) return { error: `Could not save cottage: ${error.message}` };

  revalidatePath("/map");
  return { saved: true };
}
```

Notes:
- Returns `{ saved: true }` on success (no redirect) so the popover stays open and can update its UI.
- App-layer admin check fires before any DB hit; RLS is the authoritative gate.
- `household_id = ""` (the "(none)" option in the dropdown) becomes null → cottage is vacated.

## Placeholder SVG

`src/components/map/placeholder-svg.tsx`:

```tsx
import { forwardRef, type SVGProps } from "react";

const PLACEHOLDER_COTTAGES = [
  { id: "placeholder-01", x: 60,  y: 40,  label: "01" },
  { id: "placeholder-02", x: 180, y: 60,  label: "02" },
  // ... ~15 total, arranged in a rough cluster around a "lake" shape
];

export const PlaceholderSvg = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function PlaceholderSvg(props, ref) {
    return (
      <svg ref={ref} viewBox="0 0 600 400" className="h-full w-full" {...props}>
        {/* Base layer: lake silhouette, simple roads */}
        <rect x="50" y="200" width="500" height="100" rx="40" className="fill-sky-100" />
        {/* Cottage layer: clickable groups */}
        {PLACEHOLDER_COTTAGES.map((c) => (
          <g key={c.id} data-cottage-id={c.id} className="cursor-pointer">
            <rect
              x={c.x}
              y={c.y}
              width={50}
              height={36}
              rx={4}
              className="fill-amber-50 stroke-amber-700 transition-colors hover:fill-amber-200"
            />
            <text
              x={c.x + 25}
              y={c.y + 22}
              textAnchor="middle"
              className="pointer-events-none fill-amber-900 text-[10px]"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    );
  },
);
```

`PLACEHOLDER_COTTAGES` is duplicated in `src/lib/cottages/placeholder.ts` (just the `id` and a slightly more evocative `name`, e.g., "Cottage 01") for the seed script.

The placeholder layout is intentionally simple — admins are the only viewers and the goal is to verify interactions, not to look pretty.

## CLI script: `seed-cottages.ts`

`scripts/seed-cottages.ts`:

- Reads `src/lib/cottages/placeholder.ts` by default; takes `--from <path>` to override.
- For each `{ map_element_id, name }` in the list:
  - If a cottage with that `map_element_id` exists → skip.
  - Otherwise → INSERT `{ name, map_element_id }` (other fields default to null).
- Prints how many were inserted vs skipped.
- Uses `SUPABASE_SERVICE_ROLE_KEY` (admin operations only).
- Idempotent. Safe to re-run after every illustration update; will only add new rows.

Add to package.json scripts:

```json
"seed-cottages": "node --env-file=.env.local --import tsx scripts/seed-cottages.ts"
```

## Error handling

- Click on a `<g data-cottage-id="...">` whose ID doesn't exist in `cottages`: popover shows "This cottage isn't linked to data yet — run `pnpm seed-cottages` to add it." Admins read the message, run the script, refresh. No inline-create affordance (the SVG is the source of truth; cottage rows mirror it via the script).
- Save errors surface inline in the popover.
- Pan/zoom edge cases (max bounds, momentum, two-finger handling on mobile) — `panzoom` handles.
- A cottage linked to a household that gets deleted: FK `ON DELETE SET NULL` makes the cottage vacant automatically. Popover shows "Currently vacant."

## Testing

Same precedent as Phases 1-3: no automated suite. Manual verification per task in the implementation plan. The plan's wrap-up includes a checklist covering:
- Admin can reach `/map`; member sees "coming soon."
- Clicking a cottage opens the popover (desktop) or sheet (mobile).
- Admin can link a household, set year built, edit history; save updates the popover and persists.
- Pan and zoom work via mouse drag/wheel and touch drag/pinch.
- CLI seed script is idempotent.

## Build sequence

1. Migration: `cottages` table + RLS + indexes + trigger; regenerate types.
2. `placeholder.ts` data + `placeholder-svg.tsx` (no interaction yet).
3. `CottageMap` client component with `panzoom`; click logging only.
4. `useMediaQuery` hook + `CottageDetailPanel` wrapper.
5. `CottagePopover` (desktop) + read view.
6. `CottageSheet` (mobile) + read view.
7. `/map/page.tsx` with admin gate + "coming soon" panel.
8. `updateCottage` Server Action + `CottageEditFields` (admin-only).
9. `scripts/seed-cottages.ts` + initial placeholder seed; verify cottages appear in popovers.
10. Polish: accessibility (focus trap on popover/sheet, Esc to close), edge cases (vacant cottages, missing data, click on unknown map_element_id).

## Open items deferred to later phases or follow-ups

- The real illustration (external dependency)
- Cottage photos (Phase 5 — depends on Supabase Storage)
- Filter overlays (V2)
- Long-form cottage history pages (V2)
- Bulk-management admin page (only if popover editing proves insufficient)
- Reconciling `cottages.name` ↔ `households.cottage_name` (deferred until clear which should win)
- Removing the admin gate + adding the Map nav link (small follow-up when illustration ships)
