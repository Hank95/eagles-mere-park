"use client";

import { useActionState } from "react";
import { setRsvp, type RsvpActionState } from "@/lib/rsvps/actions";
import { Button } from "@/components/ui/button";

type Status = "yes" | "no" | "maybe";

export function RsvpControls({
  eventId,
  currentStatus,
  currentHeadcount,
}: {
  eventId: string;
  currentStatus: Status | null;
  currentHeadcount: number | null;
}) {
  const [state, action, pending] = useActionState<RsvpActionState, FormData>(
    setRsvp,
    undefined,
  );

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />

      <div className="space-y-1">
        <label
          htmlFor="status"
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Your household
        </label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus ?? "none"}
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="none">Not responded</option>
          <option value="yes">Yes, attending</option>
          <option value="maybe">Maybe</option>
          <option value="no">No, can&apos;t make it</option>
        </select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="headcount"
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Headcount (optional)
        </label>
        <input
          id="headcount"
          name="headcount"
          type="number"
          min="0"
          defaultValue={currentHeadcount ?? ""}
          placeholder="How many people"
          className="w-full max-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save RSVP"}
      </Button>
    </form>
  );
}
