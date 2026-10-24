import { redirect } from "next/navigation";

// Roster was merged into /admin. Keep this route so any old bookmarks
// or print links still resolve to the combined dashboard.
export default function RosterRedirect() {
  redirect("/admin");
}
