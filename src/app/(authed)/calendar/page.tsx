import { createClient } from "@/lib/supabase/server";
import { CalendarGrid } from "@/components/calendar/calendar-grid";

const TIMEZONE = "America/New_York";

function monthRangeUtc(
  monthParam: string | null,
): { startUtcIso: string; endUtcIso: string } {
  let year: number;
  let month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const parts = monthParam.split("-").map(Number);
    year = parts[0];
    month = parts[1];
  } else {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    year = Number(parts.find((p) => p.type === "year")?.value);
    month = Number(parts.find((p) => p.type === "month")?.value);
  }

  // Bracket generously — the grid shows neighboring days from adjacent months.
  // Fetch from the month before to the month after to be safe.
  const startUtcIso = new Date(
    Date.UTC(year, month - 2, 1),
  ).toISOString();
  // Include the entire next month so trailing overflow cells (up to 6 days
  // into month+1, in Eastern) aren't cut off. An Eastern event on the 1st
  // of month+1 has a UTC starts_at after midnight UTC on the 1st; only by
  // extending to month+2 do we cover those cells reliably.
  const endUtcIso = new Date(
    Date.UTC(year, month + 2, 1),
  ).toISOString();
  return { startUtcIso, endUtcIso };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { startUtcIso, endUtcIso } = monthRangeUtc(month ?? null);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, is_announcement")
    .gte("starts_at", startUtcIso)
    .lt("starts_at", endUtcIso)
    .order("starts_at", { ascending: true });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <CalendarGrid monthParam={month ?? null} events={events ?? []} />
    </main>
  );
}
