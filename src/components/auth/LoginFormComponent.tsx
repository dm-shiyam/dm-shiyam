// components/auth/LoginFormComponent.tsx
"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, Mail, Lock, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Suspense } from "react";

function LoginFormContent({ defaultSignup }: { defaultSignup?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignup, setIsSignup] = useState(defaultSignup || false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const msg = searchParams.get("error");
    if (msg) {
      setError(
        msg === "OAuthSignin"
          ? "OAuth sign-in failed"
          : msg === "OAuthCallback"
            ? "OAuth callback error"
            : msg === "CredentialsSignin"
              ? "Invalid credentials"
              : "An error occurred"
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignup) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Registration failed");
          return;
        }

        setEmail("");
        setPassword("");
        setIsSignup(false);
        setError("");

        const signInRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInRes?.ok) {
          router.push("/dashboard");
        } else {
          setError("Sign-in failed after registration");
        }
      } else {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.ok) {
          router.push("/dashboard");
        } else {
          setError(result?.error || "Invalid email or password");
        }
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: "linear-gradient(180deg, #f8f9fb 0%, #eef0f4 100%)",
      }}
    >
      <div className="w-full" style={{ maxWidth: 440 }}>
        {/* Logo */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div
              className="flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600"
              style={{ width: 40, height: 40 }}
            >
              <Send className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">DM Shiyam</span>
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isSignup ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-sm text-gray-500">
            {isSignup
              ? "Start automating your Instagram DMs"
              : "Sign in to manage your automations"}
          </p>
        </div>

        {/* Form Card */}
        <div
          className="rounded-2xl bg-white mb-4"
          style={{
            border: "1px solid #d1d5db",
            padding: "28px 32px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                  style={{
                    border: "1.5px solid #9ca3af",
                    borderRadius: 12,
                    padding: "12px 16px 12px 40px",
                    background: "#f9fafb",
                  }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                  style={{
                    border: "1.5px solid #9ca3af",
                    borderRadius: 12,
                    padding: "12px 44px 12px 40px",
                    background: "#f9fafb",
                  }}
                  placeholder={isSignup ? "Min. 6 characters" : "•••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignup ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  border: "1px solid #fca5a5",
                  borderRadius: 12,
                  padding: "10px 16px",
                  background: "#fef2f2",
                }}
                className="text-sm text-red-600"
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !rounded-xl !py-3 !text-sm"
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {isSignup ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignup ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Toggle Signup/Login */}
          <div className="mt-4 text-center text-sm text-gray-500">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="text-purple-600 font-semibold hover:text-purple-700 transition-colors"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-2">
          {!isSignup && (
            <Link
              href="/forgot-password"
              className="block text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Forgot password?
            </Link>
          )}
          <p className="text-xs text-gray-400">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="hover:text-gray-600">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:text-gray-600">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginFormComponent({
  defaultSignup,
}: {
  defaultSignup?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <LoginFormContent defaultSignup={defaultSignup} />
    </Suspense>
  );
}