import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
    // Use the standard Next.js header that carries the current path through
    // server-side rendering. Fall back to /dashboard if absent.
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return <AuthedShell email={user.email ?? ""}>{children}</AuthedShell>;
}
