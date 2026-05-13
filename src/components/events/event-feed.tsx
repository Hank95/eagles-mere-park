"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventCard, type EventCardData } from "@/components/events/event-card";

export function EventFeed({ events }: { events: EventCardData[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const past = params.get("past") === "1";

  function togglePast() {
    const next = new URLSearchParams(params.toString());
    if (past) {
      next.delete("past");
    } else {
      next.set("past", "1");
    }
    startTransition(() => {
      router.replace(`/events${next.toString() ? `?${next.toString()}` : ""}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={togglePast}
            disabled={!past}
            className={`rounded-md px-3 py-1 ${!past ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={togglePast}
            disabled={past}
            className={`rounded-md px-3 py-1 ${past ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Past
          </button>
        </div>
        <a
          href="/events/new"
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          New event
        </a>
      </div>

      {events.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {past
            ? "No past events recorded."
            : "No upcoming events. Anyone can post one — click 'New event' above."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
