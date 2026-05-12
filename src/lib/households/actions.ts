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
  email_is_public?: boolean;
  phone_is_public?: boolean;
  address_is_public?: boolean;
};

function collectMemberUpdates(formData: FormData): MemberUpdate[] {
  const byId = new Map<string, MemberUpdate>();
  const ids = new Set<string>();
  for (const key of formData.keys()) {
    const match = /^member\.([^.]+)\./.exec(key);
    if (match) ids.add(match[1]);
  }

  for (const id of ids) {
    const get = (field: string) => formData.get(`member.${id}.${field}`);
    const update: MemberUpdate = { id };
    const nameVal = get("name");
    if (nameVal !== null) update.name = String(nameVal).trim();
    const roleVal = get("role");
    if (roleVal !== null) update.role = asTextOrNull(roleVal);
    const emailVal = get("email");
    if (emailVal !== null) update.email = asTextOrNull(emailVal);
    const phoneVal = get("phone");
    if (phoneVal !== null) update.phone = asTextOrNull(phoneVal);
    // Checkboxes: only present in FormData when checked. Always set the
    // flag based on presence so unchecking is recorded.
    update.email_is_public = get("email_is_public") === "on";
    update.phone_is_public = get("phone_is_public") === "on";
    update.address_is_public = get("address_is_public") === "on";
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

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const m of memberUpdates) {
    if (m.email !== undefined && m.email !== null && !EMAIL_RE.test(m.email)) {
      return { error: `'${m.email}' is not a valid email address.` };
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
