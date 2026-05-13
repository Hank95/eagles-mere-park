"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarEventChip } from "@/components/calendar/event-chip";

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  is_announcement: boolean;
};

type Cell = {
  iso: string; // YYYY-MM-DD in Eastern
  inMonth: boolean;
  events: CalendarEvent[];
};

const TIMEZONE = "America/New_York";

function easternIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseMonthParam(raw: string | null): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  const isoNow = easternIso(now);
  const [y, m] = isoNow.split("-").map(Number);
  return { year: y, month: m };
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function buildCells(
  year: number,
  month: number,
  events: CalendarEvent[],
): Cell[] {
  // First-of-month at noon UTC to avoid TZ edge cases.
  const firstUtc = new Date(Date.UTC(year, month - 1, 1, 12));
  // Eastern weekday for the 1st (0 = Sunday). easternIso gives the local
  // YYYY-MM-DD; appending T12:00:00Z makes the parse unambiguous regardless
  // of the server's local TZ, and the calendar weekday of a date string is
  // invariant under TZ (it depends only on the calendar date).
  const firstWeekday = new Date(
    easternIso(firstUtc) + "T12:00:00Z",
  ).getUTCDay();

  const cells: Cell[] = [];
  // 42 cells = 6 weeks
  const start = new Date(firstUtc);
  start.setUTCDate(1 - firstWeekday);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const day = easternIso(new Date(e.starts_at));
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(e);
  }

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = easternIso(d);
    const cellMonth = Number(iso.split("-")[1]);
    cells.push({
      iso,
      inMonth: cellMonth === month,
      events: eventsByDay.get(iso) ?? [],
    });
  }

  return cells;
}

export function CalendarGrid({
  monthParam,
  events,
}: {
  monthParam: string | null;
  events: CalendarEvent[];
}) {
  const router = useRouter();
  const { year, month } = parseMonthParam(monthParam);

  const cells = useMemo(
    () => buildCells(year, month, events),
    [year, month, events],
  );

  function go(delta: -1 | 0 | 1) {
    if (delta === 0) {
      router.push("/calendar");
      return;
    }
    const next = new Date(Date.UTC(year, month - 1 + delta, 15));
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    router.push(`/calendar?month=${y}-${m}`);
  }

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {monthLabel(year, month)}
        </h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => go(-1)}
            className="rounded-md border border-input px-3 py-1 hover:bg-muted"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(0)}
            className="rounded-md border border-input px-3 py-1 hover:bg-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-md border border-input px-3 py-1 hover:bg-muted"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border">
        {dayHeaders.map((d) => (
          <div
            key={d}
            className="bg-background px-2 py-1 text-center text-xs uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const day = Number(cell.iso.split("-")[2]);
          const visible = cell.events.slice(0, 3);
          const overflow = cell.events.length - visible.length;
          return (
            <div
              key={cell.iso}
              className={`min-h-[5rem] bg-background p-1 ${cell.inMonth ? "" : "opacity-40"}`}
            >
              <div className="text-right text-xs text-muted-foreground">
                {day}
              </div>
              <div className="mt-1 space-y-0.5">
                {visible.map((e) => (
                  <CalendarEventChip
                    key={e.id}
                    id={e.id}
                    title={e.title}
                    starts_at={e.starts_at}
                    is_announcement={e.is_announcement}
                  />
                ))}
                {overflow > 0 ? (
                  <a
                    href={`/events?day=${cell.iso}`}
                    className="block truncate rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    +{overflow} more
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
