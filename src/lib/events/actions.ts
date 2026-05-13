"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { easternDateFromInput } from "@/lib/events/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type EventActionState = { error?: string } | undefined;

function asTextOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export async function createEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  const description = asTextOrNull(formData.get("description"));
  const startsAtInput = String(formData.get("starts_at") ?? "");
  const endsAtInput = asTextOrNull(formData.get("ends_at"));
  const location = asTextOrNull(formData.get("location"));
  const rsvpEnabled = formData.get("rsvp_enabled") === "on";
  const isAnnouncement = formData.get("is_announcement") === "on";

  if (!title) return { error: "Title is required." };
  if (!startsAtInput) return { error: "Start date/time is required." };
  if (isAnnouncement && !isAdmin(user)) {
    return { error: "Only admins can post announcements." };
  }

  const starts_at = easternDateFromInput(startsAtInput);
  const ends_at = endsAtInput ? easternDateFromInput(endsAtInput) : null;

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      description,
      starts_at,
      ends_at,
      location,
      is_announcement: isAnnouncement,
      rsvp_enabled: rsvpEnabled,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: `Could not create event: ${error?.message}` };
  }

  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect(`/events/${data.id}`);
}
