"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { easternDateFromInput, isDatetimeLocalString } from "@/lib/events/format";
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
  if (!isDatetimeLocalString(startsAtInput)) {
    return { error: "Invalid start date format." };
  }
  if (endsAtInput && !isDatetimeLocalString(endsAtInput)) {
    return { error: "Invalid end date format." };
  }
  if (isAnnouncement && !isAdmin(user)) {
    return { error: "Only admins can post announcements." };
  }

  const starts_at = easternDateFromInput(startsAtInput);
  const ends_at = endsAtInput ? easternDateFromInput(endsAtInput) : null;

  if (ends_at && new Date(ends_at) < new Date(starts_at)) {
    return { error: "End time must be after start time." };
  }

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

export async function updateEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing event id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Fetch the existing event to enforce ownership at the app layer.
  const { data: existing } = await supabase
    .from("events")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Event not found." };

  const adminViewer = isAdmin(user);
  if (!adminViewer && existing.created_by !== user.id) {
    return { error: "Not authorized." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = asTextOrNull(formData.get("description"));
  const startsAtInput = String(formData.get("starts_at") ?? "");
  const endsAtInput = asTextOrNull(formData.get("ends_at"));
  const location = asTextOrNull(formData.get("location"));
  const rsvpEnabled = formData.get("rsvp_enabled") === "on";
  const isAnnouncement = formData.get("is_announcement") === "on";

  if (!title) return { error: "Title is required." };
  if (!startsAtInput) return { error: "Start date/time is required." };
  if (!isDatetimeLocalString(startsAtInput)) {
    return { error: "Invalid start date format." };
  }
  if (endsAtInput && !isDatetimeLocalString(endsAtInput)) {
    return { error: "Invalid end date format." };
  }
  if (isAnnouncement && !adminViewer) {
    return { error: "Only admins can mark events as announcements." };
  }

  const starts_at = easternDateFromInput(startsAtInput);
  const ends_at = endsAtInput ? easternDateFromInput(endsAtInput) : null;

  if (ends_at && new Date(ends_at) < new Date(starts_at)) {
    return { error: "End time must be after start time." };
  }

  const { error } = await supabase
    .from("events")
    .update({
      title,
      description,
      starts_at,
      ends_at,
      location,
      is_announcement: isAnnouncement,
      rsvp_enabled: rsvpEnabled,
    })
    .eq("id", id);
  if (error) return { error: `Could not save event: ${error.message}` };

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect(`/events/${id}`);
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS will authoritatively block unauthorized deletes; this is the
  // app-layer fast-path. We don't return errors from delete because the
  // client form uses confirm() pre-submit and then redirects unconditionally.
  await supabase.from("events").delete().eq("id", id);

  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect("/events");
}
