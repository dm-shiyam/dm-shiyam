// V9 — Server-side admin guard.
//
// Redirects any request to /admin/** to /login (anonymous) or /dashboard
// (signed-in non-admins) *before* any client JS ships, so the giant
// AdminPage bundle never even downloads for unauthorized users.
//
// Runs on every navigation into the /admin subtree because Next.js
// invokes the closest layout on each request.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }
  const user = await getUserByEmail(session.user.email);
  if (!user || user.role !== "admin") {
    // Silently bounce non-admins to the regular dashboard instead of
    // leaking the existence of the admin route with a 403 page.
    redirect("/dashboard");
  }
  return <>{children}</>;
}
