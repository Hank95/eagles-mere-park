import { createClient } from "@supabase/supabase-js";
import { PLACEHOLDER_COTTAGES } from "../src/lib/cottages/placeholder";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type CottageSeed = { id: string; name: string };

async function seed(rows: CottageSeed[]) {
  const ids = rows.map((r) => r.id);
  const { data: existing, error: selectError } = await supabase
    .from("cottages")
    .select("map_element_id")
    .in("map_element_id", ids);
  if (selectError) {
    console.error("Failed to query existing cottages:", selectError.message);
    process.exit(1);
  }
  const existingIds = new Set((existing ?? []).map((r) => r.map_element_id));
  const toInsert = rows
    .filter((r) => !existingIds.has(r.id))
    .map((r) => ({ name: r.name, map_element_id: r.id }));

  if (toInsert.length === 0) {
    console.log(
      `✓ All ${rows.length} cottages already exist. Nothing to insert.`,
    );
    return;
  }

  const { error: insertError } = await supabase.from("cottages").insert(toInsert);
  if (insertError) {
    console.error("Failed to insert cottages:", insertError.message);
    process.exit(1);
  }

  console.log(
    `✓ Inserted ${toInsert.length} new cottage${toInsert.length === 1 ? "" : "s"}. ${
      existingIds.size
    } already existed.`,
  );
}

const rows: CottageSeed[] = PLACEHOLDER_COTTAGES.map((c) => ({
  id: c.id,
  name: c.name,
}));

seed(rows).catch((err) => {
  console.error(err);
  process.exit(1);
});
