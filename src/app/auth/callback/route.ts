import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-redirect";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/reset-password?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/reset-password?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
