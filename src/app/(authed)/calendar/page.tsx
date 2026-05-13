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
  const endUtcIso = new Date(
    Date.UTC(year, month + 1, 1),
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
