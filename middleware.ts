import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Refresh session on every request so cookies stay fresh.
  const { data: { user } } = await supabase.auth.getUser();

  // Protect /admin routes. Two public-without-session exceptions:
  //  - /admin/login (always public)
  //  - /admin/set-password ONLY when the URL has a ?code=... PKCE auth
  //    code from a fresh Supabase invite/recovery link. Direct visits
  //    without a code (random URL guessers) get bounced to login.
  const path = request.nextUrl.pathname;
  const hasAuthCode = request.nextUrl.searchParams.has("code");
  const isPublicAdmin =
    path === "/admin/login" ||
    (path === "/admin/set-password" && hasAuthCode);
  const isAdminRoute = path.startsWith("/admin") && !isPublicAdmin;
  if (isAdminRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
