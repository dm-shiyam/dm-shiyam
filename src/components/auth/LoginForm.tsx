// src/components/auth/LoginForm.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

interface Props {
  defaultSignup?: boolean;
}

export default function LoginForm({ defaultSignup = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [isSignup, setIsSignup] = useState(defaultSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        name: isSignup ? name : undefined,
        action: isSignup ? "signup" : "login",
        redirect: false,
      });

      if (result?.error) {
        setError(result.error === "CredentialsSignin"
          ? "Invalid email or password"
          : result.error);
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    signIn("google", { callbackUrl });
  };

  const handleToggle = () => {
    setError("");
    if (isSignup) {
      router.push("/login");
    } else {
      router.push("/register");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(180deg, #f8f9fb 0%, #eef0f4 100%)" }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="mb-5 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600"
              style={{ width: 40, height: 40 }}>
              <Send className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">DM Shiyam</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isSignup
              ? "Start automating your Instagram DMs today"
              : "Sign in to manage your automations"}
          </p>
        </div>

        <div className="rounded-2xl bg-white"
          style={{ border: "1px solid #d1d5db", padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>

          {/* Google Sign In */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
            style={{ border: "1px solid #9ca3af", borderRadius: 12, padding: "12px 16px" }}
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3" style={{ margin: "20px 0" }}>
            <div className="flex-1" style={{ borderTop: "1px solid #d1d5db" }} />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">or</span>
            <div className="flex-1" style={{ borderTop: "1px solid #d1d5db" }} />
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                    style={{ border: "1.5px solid #9ca3af", borderRadius: 12, padding: "12px 16px 12px 40px", background: "#f9fafb" }}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isSignup}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                  style={{ border: "1.5px solid #9ca3af", borderRadius: 12, padding: "12px 16px 12px 40px", background: "#f9fafb" }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                  style={{ border: "1.5px solid #9ca3af", borderRadius: 12, padding: "12px 44px 12px 40px", background: "#f9fafb" }}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* ✅ Forgot password link — only shown on login */}
              {!isSignup && (
                <div className="text-right mt-1.5">
                  <Link href="/forgot-password" className="text-xs text-purple-600 hover:text-purple-700">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div style={{ border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 16px", background: "#fef2f2" }}
                className="text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !rounded-xl !py-3 !text-sm"
              style={{ marginTop: 8 }}
            >
              {loading ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="text-center text-sm text-gray-500" style={{ marginTop: 20 }}>
            {isSignup ? (
              <>Already have an account?{" "}
                <button onClick={handleToggle} className="font-semibold text-purple-600 hover:text-purple-700">
                  Sign in
                </button>
              </>
            ) : (
              <>Don&apos;t have an account?{" "}
                <button onClick={handleToggle} className="font-semibold text-purple-600 hover:text-purple-700">
                  Sign up free
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}