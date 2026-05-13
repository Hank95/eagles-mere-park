import type { Database } from "@/lib/database.types";

type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];

export type RsvpSummary = {
  yes: number;
  no: number;
  maybe: number;
  headcount: number;
};

export function rsvpSummary(
  rsvps: Pick<RsvpRow, "status" | "headcount">[],
): RsvpSummary {
  const summary: RsvpSummary = { yes: 0, no: 0, maybe: 0, headcount: 0 };
  for (const r of rsvps) {
    if (r.status === "yes") {
      summary.yes++;
      summary.headcount += r.headcount ?? 0;
    } else if (r.status === "no") {
      summary.no++;
    } else if (r.status === "maybe") {
      summary.maybe++;
    }
  }
  return summary;
}
