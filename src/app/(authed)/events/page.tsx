import { createClient } from "@/lib/supabase/server";
import { EventFeed } from "@/components/events/event-feed";
import type { EventCardData } from "@/components/events/event-card";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string; day?: string }>;
}) {
  const { past, day } = await searchParams;
  const showPast = past === "1";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // When ?day=YYYY-MM-DD is set, ignore past/upcoming and filter to that
  // single Eastern day. Bracket: midnight Eastern → midnight Eastern next day.
  // We bracket the UTC window generously (calendar-date 00:00 UTC → calendar-date+2 00:00 UTC)
  // to be safe across DST edges; the chip click target is calendar-only.
  let query = supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: !showPast });

  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, mo, d] = day.split("-").map(Number);
    const start = new Date(Date.UTC(y, mo - 1, d, 0)).toISOString();
    const end = new Date(Date.UTC(y, mo - 1, d + 2, 0)).toISOString();
    query = query.gte("starts_at", start).lt("starts_at", end);
  } else if (showPast) {
    query = query.lt("starts_at", nowIso);
  } else {
    query = query.gte("starts_at", nowIso);
  }

  const { data: events, error } = await query;

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600">
          Could not load events: {error.message}
        </p>
      </main>
    );
  }

  // Build creator-name map: events.created_by → auth.users.id → members.name
  const creatorIds = Array.from(new Set(events.map((e) => e.created_by)));
  const { data: creators } = await supabase
    .from("members")
    .select("user_id, name")
    .in("user_id", creatorIds);
  const creatorNameByUserId = new Map<string, string>();
  for (const c of creators ?? []) {
    if (c.user_id) creatorNameByUserId.set(c.user_id, c.name);
  }

  // Fetch RSVPs for these events to build summaries
  const eventIds = events.map((e) => e.id);
  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("event_id, status, headcount")
    .in("event_id", eventIds);

  const summaryByEvent = new Map<
    string,
    { yes: number; no: number; maybe: number; headcount: number }
  >();
  for (const eId of eventIds) {
    summaryByEvent.set(eId, { yes: 0, no: 0, maybe: 0, headcount: 0 });
  }
  for (const r of rsvps ?? []) {
    const s = summaryByEvent.get(r.event_id);
    if (!s) continue;
    if (r.status === "yes") {
      s.yes++;
      s.headcount += r.headcount ?? 0;
    } else if (r.status === "no") {
      s.no++;
    } else if (r.status === "maybe") {
      s.maybe++;
    }
  }

  const cards: EventCardData[] = events.map((e) => ({
    ...e,
    creator_name: creatorNameByUserId.get(e.created_by) ?? null,
    rsvp_summary: summaryByEvent.get(e.id) ?? {
      yes: 0,
      no: 0,
      maybe: 0,
      headcount: 0,
    },
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      </header>
      <EventFeed events={cards} />
    </main>
  );
}
