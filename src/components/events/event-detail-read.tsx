import { AnnouncementChip } from "@/components/events/announcement-chip";
import { RsvpControls } from "@/components/events/rsvp-controls";
import { formatEventDateTime, formatEventTime } from "@/lib/events/format";
import { rsvpSummary } from "@/lib/rsvps/aggregate";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];
type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];

export type AttendingHousehold = Pick<
  HouseholdRow,
  "id" | "cottage_name"
> & {
  headcount: number | null;
  status: "yes" | "maybe" | "no";
};

export function EventDetailRead({
  event,
  creatorName,
  rsvps,
  attendingHouseholds,
  viewerHouseholdId,
  viewerRsvp,
  canManage,
}: {
  event: EventRow;
  creatorName: string | null;
  rsvps: Pick<RsvpRow, "status" | "headcount">[];
  attendingHouseholds: AttendingHousehold[];
  viewerHouseholdId: string | null;
  viewerRsvp: { status: "yes" | "no" | "maybe"; headcount: number | null } | null;
  canManage: boolean;
}) {
  const summary = rsvpSummary(rsvps);

  return (
    <article className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {event.is_announcement ? <AnnouncementChip /> : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {event.title}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Posted by {creatorName ?? "(unlisted)"}
        </p>
      </header>

      <section className="space-y-1">
        <p className="text-sm">
          <span className="font-medium">{formatEventDateTime(event.starts_at)}</span>
          {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
        </p>
        {event.location ? (
          <p className="text-sm text-muted-foreground">{event.location}</p>
        ) : null}
      </section>

      {event.description ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            About
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {event.description}
          </p>
        </section>
      ) : null}

      {event.rsvp_enabled ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            RSVPs
          </h2>
          <p className="mt-1 text-sm">
            {summary.yes} household{summary.yes === 1 ? "" : "s"} attending
            {summary.headcount > 0
              ? ` (${summary.headcount} ${summary.headcount === 1 ? "person" : "people"})`
              : ""}
            {summary.maybe > 0 ? ` · ${summary.maybe} maybe` : ""}
            {summary.no > 0 ? ` · ${summary.no} declined` : ""}
          </p>
          {attendingHouseholds.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {attendingHouseholds.map((h) => (
                <li key={h.id}>
                  {h.cottage_name}
                  {h.headcount ? ` (${h.headcount})` : ""}
                </li>
              ))}
            </ul>
          ) : null}

          {viewerHouseholdId ? (
            <RsvpControls
              eventId={event.id}
              currentStatus={viewerRsvp?.status ?? null}
              currentHeadcount={viewerRsvp?.headcount ?? null}
            />
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              You&apos;re not in a household — RSVPs are per household.
            </p>
          )}
        </section>
      ) : null}

      {canManage ? (
        <div className="flex gap-2">
          <a
            href={`/events/${event.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        </div>
      ) : null}
    </article>
  );
}
