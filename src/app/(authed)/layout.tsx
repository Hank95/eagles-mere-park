import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthedShell } from "@/components/layout/authed-shell";

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
    redirect("/login");
  }

  return <AuthedShell email={user.email ?? ""}>{children}</AuthedShell>;
}
