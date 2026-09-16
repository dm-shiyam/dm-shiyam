"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Send, Mail, RefreshCw, CheckCircle } from "lucide-react";

function PendingContent({ email }: { email: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "invalid"
      ? "That verification link is invalid or has expired. Send a fresh one below."
      : errorParam === "missing"
        ? "Verification link was missing a token. Send a fresh one below."
        : null
  );

  // Poll for verification completion so this tab auto-redirects the
  // moment the user clicks the link in their email (which opens in a
  // new tab and updates email_verified_at in DB). Without this, the
  // user has to manually refresh — Priyanka flagged this UX gap on
  // 2026-09-16. Poll interval of 3s balances responsiveness against
  // server load; polling stops once the tab is closed or verified.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/auth/verification-status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified && !cancelled) {
          // Show a brief "Verified!" state before the navigation kicks
          // in so the user gets a clear success signal (otherwise the
          // page just abruptly changes and feels janky).
          setVerifying(true);
          // Full navigation so the /dashboard page re-runs its server
          // guard against fresh session/user state.
          setTimeout(() => {
            if (!cancelled) router.push("/dashboard?verified=1");
          }, 500);
        }
      } catch {
        // Silent — will retry on next tick. Network blips shouldn't
        // surface a scary error on this friendly onboarding page.
      }
    };

    // Fire once immediately (handles the case where the user verified
    // in another tab BEFORE landing back on this page — race window
    // when they had multiple tabs open).
    check();
    const interval = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  const resend = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Optimistic success screen once polling detects email_verified_at is
  // set. Shown for ~500ms before router.push transitions to /dashboard.
  if (verifying) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Email verified!</h2>
        <p className="mt-2 text-sm text-gray-600">Taking you to your dashboard…</p>
        <RefreshCw className="mx-auto mt-4 h-5 w-5 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
          <Mail className="h-7 w-7 text-purple-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Check your inbox</h2>
        <p className="mt-2 text-sm text-gray-600">
          We sent a verification link to
          <br />
          <span className="font-semibold text-gray-900">{email}</span>
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Click the link in that email to activate your account. The link expires in 24 hours.
        </p>
        <p className="mt-2 text-xs text-purple-600">
          This page will refresh automatically once you verify.
        </p>
      </div>

      {sent && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700" style={{ border: "1px solid #86efac" }}>
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>New verification email sent. Please check your inbox (and spam folder).</span>
        </div>
      )}

      {error && !sent && (
        <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" style={{ border: "1px solid #fca5a5" }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={resend}
        disabled={loading}
        className="btn-primary mt-5 w-full !rounded-xl !py-3 !text-sm"
      >
        {loading ? "Sending..." : sent ? "Resend again" : "Resend verification email"}
      </button>

      <div className="mt-4 text-center text-xs text-gray-500">
        Wrong email address?{" "}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/register" })}
          className="text-purple-600 hover:underline"
        >
          Sign out and try a different one
        </button>
      </div>
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
    </div>
  );
}

export default function VerifyEmailPendingComponent({ email }: { email: string }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <div
        className="flex min-h-screen items-center justify-center px-4 py-12"
        style={{ background: "linear-gradient(180deg, #f8f9fb 0%, #eef0f4 100%)" }}
      >
        <div className="w-full" style={{ maxWidth: 440 }}>
          <div className="mb-5 text-center">
            <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
              <div
                className="flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600"
                style={{ width: 40, height: 40 }}
              >
                <Send className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">DM Shiyam</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
            <p className="mt-1 text-sm text-gray-500">One quick step before you get started</p>
          </div>

          <div
            className="rounded-2xl bg-white"
            style={{
              border: "1px solid #d1d5db",
              padding: "28px 32px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}
          >
            <PendingContent email={email} />
          </div>
        </div>
      </div>
    </Suspense>
  );
}
