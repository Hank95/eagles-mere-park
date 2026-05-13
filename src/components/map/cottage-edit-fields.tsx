"use client";

import { useActionState, useState } from "react";
import { updateCottage, type UpdateCottageState } from "@/lib/cottages/actions";
import type {
  CottageDetailData,
  HouseholdOption,
} from "@/components/map/cottage-detail-panel";
import { Button } from "@/components/ui/button";

export function CottageEditFields({
  cottage,
  householdOptions,
}: {
  cottage: CottageDetailData;
  householdOptions: HouseholdOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    UpdateCottageState,
    FormData
  >(updateCottage, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-2"
      >
        Edit
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-border pt-3">
      <input type="hidden" name="id" value={cottage.id} />

      <div className="space-y-1">
        <label htmlFor="household_id" className="text-xs uppercase tracking-wider text-muted-foreground">
          Linked household
        </label>
        <select
          id="household_id"
          name="household_id"
          defaultValue={cottage.household_id ?? ""}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">(none — vacant)</option>
          {householdOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="year_built" className="text-xs uppercase tracking-wider text-muted-foreground">
          Year built
        </label>
        <input
          id="year_built"
          name="year_built"
          type="number"
          min="1700"
          max="2100"
          defaultValue={cottage.year_built ?? ""}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="history_text" className="text-xs uppercase tracking-wider text-muted-foreground">
          History snippet
        </label>
        <textarea
          id="history_text"
          name="history_text"
          rows={3}
          defaultValue={cottage.history_text ?? ""}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-xs text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.saved ? (
        <p className="text-xs text-emerald-600" role="status">
          Saved. Refresh the page to see updated values.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
