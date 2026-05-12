"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type UpdateHouseholdState =
  | { error?: string; saved?: boolean }
  | undefined;

function asTextOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function asIntOrNull(value: FormDataEntryValue | null): number | null {
  const s = asTextOrNull(value);
  if (s === null) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

type MemberUpdate = {
  id: string;
  name?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
};

function collectMemberUpdates(formData: FormData): MemberUpdate[] {
  const byId = new Map<string, MemberUpdate>();
  for (const [key, value] of formData.entries()) {
    const match = /^member\.([^.]+)\.(.+)$/.exec(key);
    if (!match) continue;
    const [, id, field] = match;
    const update = byId.get(id) ?? { id };
    if (field === "name") update.name = String(value).trim();
    else if (field === "role") update.role = asTextOrNull(value);
    else if (field === "email") update.email = asTextOrNull(value);
    else if (field === "phone") update.phone = asTextOrNull(value);
    byId.set(id, update);
  }
  return Array.from(byId.values());
}

export async function updateHousehold(
  _prev: UpdateHouseholdState,
  formData: FormData,
): Promise<UpdateHouseholdState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing household id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // App-layer authorization (RLS is authoritative; this exists for friendlier
  // errors and to short-circuit before any DB writes).
  if (!isAdmin(user)) {
    const { data: own } = await supabase
      .from("members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (own?.household_id !== id) {
      return { error: "Not authorized." };
    }
  }

  const householdPatch = {
    cottage_name: String(formData.get("cottage_name") ?? "").trim(),
    street_address: asTextOrNull(formData.get("street_address")),
    arrival_year: asIntOrNull(formData.get("arrival_year")),
    is_year_round: formData.get("is_year_round") === "on",
    is_unlisted: formData.get("is_unlisted") === "on",
    bio: asTextOrNull(formData.get("bio")),
  };

  if (!householdPatch.cottage_name) {
    return { error: "Cottage name is required." };
  }

  // Validate all member fields before any writes.
  const memberUpdates = collectMemberUpdates(formData);
  for (const m of memberUpdates) {
    if (m.name !== undefined && m.name === "") {
      return { error: "Member name cannot be empty." };
    }
  }

  // Now write. RLS authoritatively blocks unauthorized writes; the app-layer
  // check above provides the friendly error.
  const { error: hhError } = await supabase
    .from("households")
    .update(householdPatch)
    .eq("id", id);
  if (hhError) {
    return { error: `Could not save household: ${hhError.message}` };
  }

  for (const m of memberUpdates) {
    const { id: memberId, ...patch } = m;
    if (Object.keys(patch).length === 0) continue;
    const { error: mError } = await supabase
      .from("members")
      .update(patch)
      .eq("id", memberId);
    if (mError) {
      return {
        error: `Could not save member ${memberId}: ${mError.message}`,
      };
    }
  }

  revalidatePath(`/households/${id}`);
  revalidatePath("/directory");
  redirect(`/households/${id}`);
}
