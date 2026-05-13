import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { EventEditForm } from "@/components/events/event-edit-form";
import { createEvent } from "@/lib/events/actions";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <EventEditForm
      initial={null}
      action={createEvent}
      isAdminViewer={isAdmin(user)}
      submitLabel="Create event"
    />
  );
}
