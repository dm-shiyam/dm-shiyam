import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";
import LoginFormComponent from "@/components/auth/LoginFormComponent";

export const metadata: Metadata = generatePageMetadata(
  "Login | DM Shiyam",
  "Sign in to your DM Shiyam account to manage Instagram automations.",
  "/login",
  ["login", "sign in", "Instagram automation"]
);

export default function LoginPage() {
  return <LoginFormComponent />;
}