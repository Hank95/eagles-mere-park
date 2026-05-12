import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Run with: pnpm dotenv -e .env.local -- pnpm tsx scripts/promote-admin.ts <email>\n" +
      "Or export them in your shell.",
  );
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: pnpm tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let createdNew = false;

  if (!user) {
    const tempPassword = `${randomUUID()}-${randomUUID()}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error("Failed to create user:", error?.message);
      process.exit(1);
    }
    user = data.user;
    createdNew = true;
  }

  const existingMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...existingMeta, is_admin: true },
  });

  if (updateError) {
    console.error("Failed to set is_admin:", updateError.message);
    process.exit(1);
  }

  if (createdNew) {
    console.log(
      `Created user ${user.email ?? email} (id: ${user.id}) with a random temp password.\n` +
        `Have them visit /reset-password to set their own password.`,
    );
  }
  console.log(`✓ ${email} is now admin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
