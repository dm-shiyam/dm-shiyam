"use client";

import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
    </div>
  );
}

export default function RegisterFormComponent() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm defaultSignup />
    </Suspense>
  );
}