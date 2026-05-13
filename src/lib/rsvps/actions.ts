"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RsvpActionState = { error?: string } | undefined;

function asIntOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function setRsvp(
  _prev: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const event_id = String(formData.get("event_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const headcount = asIntOrNull(formData.get("headcount"));

  if (!event_id) return { error: "Missing event id." };
  if (!["yes", "no", "maybe", "none"].includes(status)) {
    return { error: "Invalid RSVP status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Look up viewer's household.
  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!own?.household_id) {
    return {
      error: "You're not in a household yet — RSVPs are per household.",
    };
  }

  if (status === "none") {
    const { error } = await supabase
      .from("rsvps")
      .delete()
      .eq("event_id", event_id)
      .eq("household_id", own.household_id);
    if (error) return { error: `Could not remove RSVP: ${error.message}` };
  } else {
    const { error } = await supabase.from("rsvps").upsert(
      {
        event_id,
        household_id: own.household_id,
        status,
        headcount: status === "yes" ? headcount : null,
      },
      { onConflict: "event_id,household_id" },
    );
    if (error) return { error: `Could not save RSVP: ${error.message}` };
  }

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/events");
  return undefined;
}
