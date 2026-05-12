import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthedShell } from "@/components/layout/authed-shell";
import { claimMemberRowIfNeeded } from "@/lib/members/claim";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  await claimMemberRowIfNeeded(supabase, user);

  return <AuthedShell email={user.email ?? ""}>{children}</AuthedShell>;
}
