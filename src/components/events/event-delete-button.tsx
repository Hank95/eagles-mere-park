"use client";

import { deleteEvent } from "@/lib/events/actions";
import { Button } from "@/components/ui/button";

export function EventDeleteButton({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  return (
    <form
      action={deleteEvent}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${eventTitle}"? This will also remove all RSVPs and cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      <Button type="submit" variant="ghost" size="sm">
        Delete
      </Button>
    </form>
  );
}
