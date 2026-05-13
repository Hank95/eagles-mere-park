"use client";

import { formatEventTime } from "@/lib/events/format";

export function CalendarEventChip({
  id,
  title,
  starts_at,
  is_announcement,
}: {
  id: string;
  title: string;
  starts_at: string;
  is_announcement: boolean;
}) {
  const tone = is_announcement
    ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
    : "bg-sky-100 text-sky-900 hover:bg-sky-200";
  return (
    <a
      href={`/events/${id}`}
      title={`${formatEventTime(starts_at)} — ${title}`}
      className={`block truncate rounded px-1 py-0.5 text-xs ${tone}`}
    >
      {formatEventTime(starts_at)} {title}
    </a>
  );
}
