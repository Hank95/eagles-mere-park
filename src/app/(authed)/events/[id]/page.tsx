import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  EventDetailRead,
  type AttendingHousehold,
} from "@/components/events/event-detail-read";
import { EventEditForm } from "@/components/events/event-edit-form";
import { updateEvent } from "@/lib/events/actions";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
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

  const adminViewer = isAdmin(user);
  const canManage = adminViewer || event.created_by === user.id;

  if (edit === "1") {
    if (!canManage) redirect(`/events/${id}`);
    return (
      <EventEditForm
        initial={event}
        action={updateEvent}
        isAdminViewer={adminViewer}
        submitLabel="Save changes"
      />
    );
  }

  // Read view
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
