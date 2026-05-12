import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    name: { type: "string" },
    "household-id": { type: "string" },
    "new-household": { type: "string" },
    street: { type: "string" },
    role: { type: "string" },
  },
  allowPositionals: true,
});

const email = positionals[0];
const name = values.name;
const householdId = values["household-id"];
const newHouseholdName = values["new-household"];
const street = values.street;
const role = values.role;

function usage(msg?: string): never {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    "Usage: pnpm invite-member <email> --name \"Jim Smith\"\n" +
      "         (--household-id <uuid> | --new-household \"The Pines\" [--street \"12 Lake Rd\"])\n" +
      "         [--role \"year-round\"]\n",
  );
  process.exit(1);
}

if (!email) usage("email is required");
if (!name) usage("--name is required");
if (!householdId && !newHouseholdName) {
  usage("either --household-id or --new-household is required");
}
if (householdId && newHouseholdName) {
  usage("pass either --household-id or --new-household, not both");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let resolvedHouseholdId: string;

  if (newHouseholdName) {
    const { data, error } = await supabase
      .from("households")
      .insert({
        cottage_name: newHouseholdName,
        street_address: street ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Failed to create household:", error?.message);
      process.exit(1);
    }
    resolvedHouseholdId = data.id;
    console.log(`Created household '${newHouseholdName}' (id: ${data.id})`);
  } else {
    const { data, error } = await supabase
      .from("households")
      .select("id, cottage_name")
      .eq("id", householdId!)
      .single();
    if (error || !data) {
      console.error(`Household ${householdId} not found.`);
      process.exit(1);
    }
    resolvedHouseholdId = data.id;
    console.log(`Using existing household '${data.cottage_name}' (id: ${data.id})`);
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .insert({
      household_id: resolvedHouseholdId,
      name: name!,
      email,
      role: role ?? null,
    })
    .select("id")
    .single();
  if (memberError || !memberData) {
    console.error("Failed to insert member row:", memberError?.message);
    process.exit(1);
  }
  console.log(`Inserted member ${name} (id: ${memberData.id})`);

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    console.error("Failed to send invite:", inviteError.message);
    console.error(
      "Household and member rows were created. To retry the invite, " +
        "delete the member row and re-run.",
    );
    process.exit(1);
  }
  console.log(`✓ Invite sent to ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
