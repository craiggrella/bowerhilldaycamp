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
  //  - /admin/set-password — invitees land here with the recovery token
  //    in the URL hash (not visible server-side), so middleware can't
  //    pre-check it. The page itself enforces auth via supabase.auth
  //    .getSession(): no valid session = "invite expired" message and
  //    no form. So a random URL visitor cannot actually set a password.
  // Decode first: the router resolves /%61dmin to /admin, so the check must
  // see the same path or encoded URLs skip the redirect.
  let path = request.nextUrl.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed encoding: keep the raw path.
  }
  const isPublicAdmin =
    path === "/admin/login" || path === "/admin/set-password";
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
