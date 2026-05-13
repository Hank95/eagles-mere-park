"use client";

import { useActionState } from "react";
import { type EventActionState } from "@/lib/events/actions";
import { easternDateInputValue } from "@/lib/events/format";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export function EventEditForm({
  initial,
  action,
  isAdminViewer,
  submitLabel,
}: {
  initial: Partial<EventRow> | null;
  action: (
    state: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  isAdminViewer: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<
    EventActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial?.description ?? ""}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="starts_at" className="text-sm font-medium">
            Starts (Eastern)
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={
              initial?.starts_at ? easternDateInputValue(initial.starts_at) : ""
            }
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ends_at" className="text-sm font-medium">
            Ends (Eastern, optional)
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={
              initial?.ends_at ? easternDateInputValue(initial.ends_at) : ""
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="location" className="text-sm font-medium">
          Location (optional)
        </label>
        <input
          id="location"
          name="location"
          defaultValue={initial?.location ?? ""}
          placeholder="Lakefront Pavilion"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="rsvp_enabled"
            defaultChecked={initial?.rsvp_enabled ?? true}
            className="h-4 w-4"
          />
          Enable RSVPs
        </label>
      </div>

      {isAdminViewer ? (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_announcement"
              defaultChecked={initial?.is_announcement ?? false}
              className="h-4 w-4"
            />
            Mark as announcement
          </label>
        </div>
      ) : null}

      {state?.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {initial?.id ? (
          <a
            href={`/events/${initial.id}`}
            className="text-sm text-muted-foreground underline underline-offset-2 self-center"
          >
            Cancel
          </a>
        ) : (
          <a
            href="/events"
            className="text-sm text-muted-foreground underline underline-offset-2 self-center"
          >
            Cancel
          </a>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
