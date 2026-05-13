"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { revalidatePath } from "next/cache";

export type UpdateCottageState =
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

export async function updateCottage(
  _prev: UpdateCottageState,
  formData: FormData,
): Promise<UpdateCottageState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing cottage id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!isAdmin(user)) return { error: "Not authorized." };

  const household_id = asTextOrNull(formData.get("household_id"));
  const year_built = asIntOrNull(formData.get("year_built"));
  const history_text = asTextOrNull(formData.get("history_text"));

  const { error, count } = await supabase
    .from("cottages")
    .update(
      { household_id, year_built, history_text },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) return { error: `Could not save cottage: ${error.message}` };
  if (count === 0) return { error: "Cottage not found." };

  revalidatePath("/map");
  return { saved: true };
}
