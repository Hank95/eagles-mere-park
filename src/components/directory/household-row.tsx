import { InitialsAvatar } from "@/components/directory/initials-avatar";
import type { Database } from "@/lib/database.types";

type HouseholdSummary = Pick<
  Database["public"]["Tables"]["households"]["Row"],
  "id" | "cottage_name" | "street_address" | "arrival_year" | "is_year_round" | "is_unlisted"
> & {
  members: Pick<
    Database["public"]["Tables"]["members"]["Row"],
    "name" | "role"
  >[];
};

function familyLastNames(members: HouseholdSummary["members"]): string {
  const lastNames = new Set(
    members
      .map((m) => m.name.trim().split(/\s+/).pop() ?? "")
      .filter(Boolean),
  );
  if (lastNames.size === 0) return "";
  return Array.from(lastNames).join(" / ");
}

export function HouseholdRow({
  household,
  showUnlistedIndicator,
}: {
  household: HouseholdSummary;
  showUnlistedIndicator: boolean;
}) {
  const family = familyLastNames(household.members);
  const unlisted = showUnlistedIndicator && household.is_unlisted;

  return (
    <a
      href={`/households/${household.id}`}
      className={`flex items-center gap-4 border-b border-border px-4 py-3 hover:bg-muted/50 ${
        unlisted ? "italic" : ""
      }`}
    >
      <InitialsAvatar name={household.cottage_name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{household.cottage_name}</span>
          {unlisted ? (
            <span
              aria-label="Unlisted"
              title="Unlisted"
              className="text-xs text-muted-foreground"
            >
              🔒
            </span>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground">
          {family || "—"}
          {household.arrival_year ? ` · since ${household.arrival_year}` : ""}
        </div>
      </div>
      <div className="hidden sm:block text-xs uppercase tracking-wider text-muted-foreground">
        {household.is_year_round ? "Year-round" : "Seasonal"}
      </div>
      <span aria-hidden="true" className="text-muted-foreground">
        ›
      </span>
    </a>
  );
}

export type { HouseholdSummary };
