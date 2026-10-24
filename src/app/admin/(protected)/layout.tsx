import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";

// Server-side auth gate for every admin page except /admin/login and
// /admin/set-password (which live outside this route group). This is
// defense in depth: middleware.ts normally redirects first, but it matches
// on the raw pathname, so encoded URLs like /%61dmin slip past it. This
// check runs on the resolved route, so it can't be bypassed that way.
// Same rule as requireAdmin(): any authenticated user is an admin.
export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) {
    // Layouts don't receive the pathname, so send them back to the dashboard
    // after login. (Middleware still sets the exact `from` for normal URLs.)
    redirect("/admin/login?from=%2Fadmin");
  }
  return children;
}
