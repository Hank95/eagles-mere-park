import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  EventDetailRead,
  type AttendingHousehold,
} from "@/components/events/event-detail-read";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: creator } = await supabase
    .from("members")
    .select("name")
    .eq("user_id", event.created_by)
    .maybeSingle();

  const { data: rsvpsData } = await supabase
    .from("rsvps")
    .select("status, headcount, household_id, households(id, cottage_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const rsvps = (rsvpsData ?? []).map((r) => ({
    status: r.status as "yes" | "no" | "maybe",
    headcount: r.headcount,
  }));

  const attendingHouseholds: AttendingHousehold[] = (rsvpsData ?? [])
    .filter((r) => r.status === "yes")
    .map((r) => ({
      id: r.households?.id ?? r.household_id,
      cottage_name: r.households?.cottage_name ?? "(unknown)",
      headcount: r.headcount,
      status: "yes" as const,
    }));

  // Viewer's household + their RSVP for this event
  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const viewerHouseholdId = own?.household_id ?? null;

  let viewerRsvp:
    | { status: "yes" | "no" | "maybe"; headcount: number | null }
    | null = null;
  if (viewerHouseholdId) {
    const ownRsvp = (rsvpsData ?? []).find(
      (r) => r.household_id === viewerHouseholdId,
    );
    if (ownRsvp) {
      viewerRsvp = {
        status: ownRsvp.status as "yes" | "no" | "maybe",
        headcount: ownRsvp.headcount,
      };
    }
  }

  const canManage = isAdmin(user) || event.created_by === user.id;

  return (
    <EventDetailRead
      event={event}
      creatorName={creator?.name ?? null}
      rsvps={rsvps}
      attendingHouseholds={attendingHouseholds}
      viewerHouseholdId={viewerHouseholdId}
      viewerRsvp={viewerRsvp}
      canManage={canManage}
    />
  );
}
