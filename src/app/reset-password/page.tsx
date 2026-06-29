"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, Lock, Eye, EyeOff, CheckCircle, RefreshCw } from "lucide-react";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600 font-semibold">Invalid reset link</p>
        <Link href="/forgot-password" className="text-sm text-purple-600 mt-2 inline-block">Request a new one</Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return done ? (
    <div className="text-center py-4">
      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
      <p className="font-semibold text-gray-900 mb-1">Password updated!</p>
      <p className="text-sm text-gray-500">Redirecting you to sign in...</p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      {["New password", "Confirm password"].map((label, i) => {
        const isConfirm = i === 1;
        const value = isConfirm ? confirm : password;
        const setter = isConfirm ? setConfirm : setPassword;
        return (
          <div key={label}>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                style={{ border: "1.5px solid #9ca3af", borderRadius: 12, padding: "12px 44px 12px 40px", background: "#f9fafb" }}
                placeholder="Min. 6 characters"
                value={value}
                onChange={(e) => setter(e.target.value)}
                required
                minLength={6}
              />
              {!isConfirm && (
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {error && (
        <div style={{ border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 16px", background: "#fef2f2" }} className="text-sm text-red-600">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full !rounded-xl !py-3 !text-sm" style={{ marginTop: 8 }}>
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-purple-500" /></div>}>
      <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "linear-gradient(180deg, #f8f9fb 0%, #eef0f4 100%)" }}>
        <div className="w-full" style={{ maxWidth: 440 }}>
          <div className="mb-5 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600" style={{ width: 40, height: 40 }}>
                <Send className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">DM Shiyam</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
            <p className="mt-1 text-sm text-gray-500">Choose something strong</p>
          </div>
          <div className="rounded-2xl bg-white" style={{ border: "1px solid #d1d5db", padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <ResetForm />
          </div>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Back to sign in</Link>
          </div>
        </div>
      </div>
    </Suspense>
  );
}