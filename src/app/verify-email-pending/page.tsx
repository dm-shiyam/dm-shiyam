import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import VerifyEmailPendingComponent from "@/components/auth/VerifyEmailPendingComponent";

export const metadata: Metadata = {
  title: "Verify your email | DM Shiyam",
  robots: "noindex, nofollow",
};

// Server guard: anonymous → login; already-verified → dashboard.
// Only unverified authenticated users see this page.
export default async function VerifyEmailPendingPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user?.email || !userId) {
    redirect(`/login?next=${encodeURIComponent("/verify-email-pending")}`);
  }

  const user = await getUserById(userId);
  if (!user) {
    redirect("/login");
  }
  if (user.email_verified_at) {
    redirect("/dashboard?verified=1");
  }

  return <VerifyEmailPendingComponent email={user.email} />;
}
