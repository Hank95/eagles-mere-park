import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectoryList } from "@/components/directory/directory-list";
import { isAdmin } from "@/lib/auth/is-admin";

export default async function DirectoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The layout already redirected to /login if unauthed.
  if (!user) return null;
  const admin = isAdmin(user);

  // If this viewer isn't admin and has no member row, send them to /no-household.
  if (!admin) {
    const { data: own } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!own) redirect("/no-household");
  }

  const { data: households, error } = await supabase
    .from("households")
    .select(
      "id, cottage_name, street_address, arrival_year, is_year_round, is_unlisted, members(name, role)",
    )
    .order("cottage_name", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600">
          Could not load directory: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Directory</h1>
        <p className="text-sm text-muted-foreground">
          {households.length} household{households.length === 1 ? "" : "s"}
        </p>
      </header>
      <DirectoryList households={households} viewerIsAdmin={admin} />
    </main>
  );
}
