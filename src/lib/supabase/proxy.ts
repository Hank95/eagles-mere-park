import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  // Forward the current pathname so Server Components can read it via next/headers.
  // Mutating request.headers directly does NOT propagate — we must pass a new
  // Headers object through NextResponse.next({ request: { headers } }).
  const requestHeaders = new Headers(request.headers);
  // Only the pathname is forwarded — query string and hash are dropped.
  // Post-login bounce preserves the path but not search params.
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth token. Do not run code between createServerClient and getUser —
  // a stale session here can cause sign-outs and weird redirect loops.
  await supabase.auth.getUser();

  return response;
}
