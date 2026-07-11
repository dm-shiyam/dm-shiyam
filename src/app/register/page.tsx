// "use client";
// import { Suspense } from "react";
// import { RefreshCw } from "lucide-react";
// import LoginForm from "@/components/auth/LoginForm";
// import { Metadata } from "next";

// export const metadata: Metadata = {
//   title: "Login | DM Shiyam",
//   robots: "noindex, nofollow", // Don't index in search engines
// };

// export default function RegisterPage() {
//   return (
//     <Suspense fallback={
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
//       </div>
//     }>
//       <LoginForm defaultSignup={true} />
//     </Suspense>
//   );
// }

import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";
import RegisterFormComponent from "@/components/auth/RegisterFormComponent";

export const metadata: Metadata = generatePageMetadata(
  "Sign Up | DM Shiyam",
  "Create your DM Shiyam account and start automating Instagram DMs.",
  "/register",
  ["sign up", "register", "create account"]
);

export default function RegisterPage() {
  return <RegisterFormComponent />;
}