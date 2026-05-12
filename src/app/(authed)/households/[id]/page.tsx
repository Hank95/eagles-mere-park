import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { HouseholdDetailRead } from "@/components/households/household-detail-read";
import { isAdmin } from "@/lib/auth/is-admin";
import type { ViewerContext } from "@/lib/households/visibility";

export default async function HouseholdPage({
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

  const { data: household } = await supabase
    .from("households")
    .select("*, members(*)")
    .eq("id", id)
    .maybeSingle();

  if (!household) notFound();

  const { data: own } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const viewer: ViewerContext = {
    id: user.id,
    isAdmin: isAdmin(user),
    householdId: own?.household_id ?? null,
  };

  const canEdit = viewer.isAdmin || viewer.householdId === household.id;

  return (
    <HouseholdDetailRead
      household={household}
      viewer={viewer}
      canEdit={canEdit}
    />
  );
}
