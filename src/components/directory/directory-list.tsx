"use client";

import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HouseholdRow,
  type HouseholdSummary,
} from "@/components/directory/household-row";

type SortKey = "cottage_name" | "family_name" | "arrival_year";
type SeasonFilter = "all" | "year-round" | "seasonal";

function lastName(h: HouseholdSummary): string {
  return (
    h.members[0]?.name.trim().split(/\s+/).pop()?.toLowerCase() ?? ""
  );
}

function compareByCottage(a: HouseholdSummary, b: HouseholdSummary): number {
  return a.cottage_name.localeCompare(b.cottage_name);
}

function compareByFamily(a: HouseholdSummary, b: HouseholdSummary): number {
  return lastName(a).localeCompare(lastName(b));
}

function compareByYear(a: HouseholdSummary, b: HouseholdSummary): number {
  return (a.arrival_year ?? Number.POSITIVE_INFINITY) -
    (b.arrival_year ?? Number.POSITIVE_INFINITY);
}

function comparator(sort: SortKey) {
  if (sort === "family_name") return compareByFamily;
  if (sort === "arrival_year") return compareByYear;
  return compareByCottage;
}

function searchMatches(h: HouseholdSummary, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (h.cottage_name.toLowerCase().includes(q)) return true;
  if (h.street_address?.toLowerCase().includes(q)) return true;
  for (const m of h.members) {
    if (m.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

function seasonMatches(h: HouseholdSummary, season: SeasonFilter): boolean {
  if (season === "all") return true;
  if (season === "year-round") return h.is_year_round === true;
  return h.is_year_round === false;
}

export function DirectoryList({
  households,
  viewerIsAdmin,
}: {
  households: HouseholdSummary[];
  viewerIsAdmin: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const query = params.get("q") ?? "";
  const season = (params.get("season") as SeasonFilter) ?? "all";
  const sort = (params.get("sort") as SortKey) ?? "cottage_name";

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || (name === "sort" && value === "cottage_name")) {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    startTransition(() => {
      router.replace(`/directory${next.toString() ? `?${next.toString()}` : ""}`);
    });
  }

  const filtered = useMemo(() => {
    const result = households
      .filter((h) => searchMatches(h, query))
      .filter((h) => seasonMatches(h, season));
    result.sort(comparator(sort));
    return result;
  }, [households, query, season, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          placeholder="Search by name, cottage, or street"
          onChange={(e) => updateParam("q", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs"
        />
        <div className="flex gap-2">
          <select
            value={season}
            onChange={(e) => updateParam("season", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All seasons</option>
            <option value="year-round">Year-round</option>
            <option value="seasonal">Seasonal</option>
          </select>
          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="cottage_name">Sort: Cottage</option>
            <option value="family_name">Sort: Family</option>
            <option value="arrival_year">Sort: Arrival year</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No households match.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {filtered.map((h) => (
            <HouseholdRow
              key={h.id}
              household={h}
              showUnlistedIndicator={viewerIsAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
