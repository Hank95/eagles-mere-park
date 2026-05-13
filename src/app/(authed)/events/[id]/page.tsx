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

  // Creator name lookup (no direct FK from events to members)
  const { data: creator } = await supabase
    .from("members")
    .select("name")
    .eq("user_id", event.created_by)
    .maybeSingle();

  // All RSVPs for this event, plus household names for the attending list
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

  const canManage = isAdmin(user) || event.created_by === user.id;

  return (
    <EventDetailRead
      event={event}
      creatorName={creator?.name ?? null}
      rsvps={rsvps}
      attendingHouseholds={attendingHouseholds}
      canManage={canManage}
    />
  );
}
