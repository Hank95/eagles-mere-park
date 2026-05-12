"use client";

import { MemberEditRow } from "@/components/households/member-edit-row";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";

type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export function HouseholdEditForm({
  household,
}: {
  household: HouseholdRow & { members: MemberRow[] };
}) {
  return (
    <form className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <input type="hidden" name="id" value={household.id} />

      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit {household.cottage_name}
        </h1>
        <a
          href={`/households/${household.id}`}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Cancel
        </a>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="cottage_name" className="text-sm font-medium">
            Cottage name
          </label>
          <input
            id="cottage_name"
            name="cottage_name"
            defaultValue={household.cottage_name}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="street_address" className="text-sm font-medium">
            Street address
          </label>
          <input
            id="street_address"
            name="street_address"
            defaultValue={household.street_address ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="arrival_year" className="text-sm font-medium">
            Arrival year
          </label>
          <input
            id="arrival_year"
            name="arrival_year"
            type="number"
            min="1850"
            max="2100"
            defaultValue={household.arrival_year ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_year_round"
              defaultChecked={household.is_year_round}
              className="h-4 w-4"
            />
            Year-round residents
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_unlisted"
              defaultChecked={household.is_unlisted}
              className="h-4 w-4"
            />
            Unlisted — hide from other members
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="bio" className="text-sm font-medium">
            About
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={household.bio ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Family
        </h2>
        <ul className="mt-2 space-y-3">
          {household.members.map((m) => (
            <MemberEditRow key={m.id} member={m} />
          ))}
        </ul>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled>
          Save (wiring in next task)
        </Button>
      </div>
    </form>
  );
}
