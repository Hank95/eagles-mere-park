import { AnnouncementChip } from "@/components/events/announcement-chip";
import { formatEventDateTime } from "@/lib/events/format";
import type { Database } from "@/lib/database.types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type EventCardData = EventRow & {
  creator_name: string | null; // null → "(unlisted)"
  rsvp_summary: {
    yes: number;
    no: number;
    maybe: number;
    headcount: number;
  };
};

export function EventCard({ event }: { event: EventCardData }) {
  return (
    <a
      href={`/events/${event.id}`}
      className="block border-b border-border px-4 py-4 hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        {event.is_announcement ? <AnnouncementChip /> : null}
        <h3 className="font-medium">{event.title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatEventDateTime(event.starts_at)}
        {event.location ? ` · ${event.location}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Posted by {event.creator_name ?? "(unlisted)"}
        {event.rsvp_summary.yes > 0
          ? ` · ${event.rsvp_summary.yes} household${event.rsvp_summary.yes === 1 ? "" : "s"} attending${
              event.rsvp_summary.headcount > 0
                ? ` (${event.rsvp_summary.headcount} ${event.rsvp_summary.headcount === 1 ? "person" : "people"})`
                : ""
            }`
          : ""}
      </p>
    </a>
  );
}
