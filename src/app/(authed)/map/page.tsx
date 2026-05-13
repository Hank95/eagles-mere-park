import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { CottageMap } from "@/components/map/cottage-map";
import type {
  CottageDetailData,
  HouseholdOption,
} from "@/components/map/cottage-detail-panel";

function ComingSoonPanel() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Eagles Mere Park
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          The map is coming soon
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          We&apos;re working with an illustrator on something worthy of the
          place. Check back.
        </p>
      </div>
    </main>
  );
}

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!isAdmin(user)) {
    return <ComingSoonPanel />;
  }

  const [cottagesRes, householdsRes] = await Promise.all([
    supabase.from("cottages").select("*").order("name", { ascending: true }),
    supabase
      .from("households")
      .select("id, cottage_name, members(name)")
      .order("cottage_name", { ascending: true }),
  ]);

  if (cottagesRes.error || householdsRes.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600">
          Could not load map data:{" "}
          {cottagesRes.error?.message ?? householdsRes.error?.message}
        </p>
      </main>
    );
  }

  const householdsById = new Map(
    (householdsRes.data ?? []).map((h) => [h.id, h]),
  );

  function familyLastNames(members: { name: string }[]): string {
    const lastNames = new Set(
      members
        .map((m) => m.name.trim().split(/\s+/).pop() ?? "")
        .filter(Boolean),
    );
    return Array.from(lastNames).join(" / ");
  }

  const cottages: CottageDetailData[] = (cottagesRes.data ?? []).map((c) => {
    const h = c.household_id ? householdsById.get(c.household_id) : null;
    return {
      ...c,
      linkedHousehold: h
        ? {
            id: h.id,
            cottage_name: h.cottage_name,
            familyLastNames: familyLastNames(h.members ?? []),
          }
        : null,
    };
  });

  const householdOptions: HouseholdOption[] = (householdsRes.data ?? []).map(
    (h) => {
      const family = familyLastNames(h.members ?? []);
      return {
        id: h.id,
        label: family ? `${h.cottage_name} (${family})` : h.cottage_name,
      };
    },
  );

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Map (admin preview)</h1>
        <p className="text-sm text-muted-foreground">
          The real illustration is in progress. This is the placeholder
          infrastructure — click a cottage to see the popover/sheet.
        </p>
      </header>
      <CottageMap
        cottages={cottages}
        householdOptions={householdOptions}
        isAdminViewer={true}
      />
    </main>
  );
}
