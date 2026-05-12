"use client";

import { HouseholdRow, type HouseholdSummary } from "@/components/directory/household-row";

export function DirectoryList({
  households,
  viewerIsAdmin,
}: {
  households: HouseholdSummary[];
  viewerIsAdmin: boolean;
}) {
  if (households.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No households to show yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {households.map((h) => (
        <HouseholdRow
          key={h.id}
          household={h}
          showUnlistedIndicator={viewerIsAdmin}
        />
      ))}
    </div>
  );
}
