// lib/session.ts
// Helper to extract userId from NextAuth session in API routes

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as Record<string, unknown>).id as string || null;
}
