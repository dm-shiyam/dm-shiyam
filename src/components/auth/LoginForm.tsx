// src/components/auth/LoginForm.tsx
"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, Mail, Lock, User, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { PASSWORD_RULES, validatePassword } from "@/lib/password-policy";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Live password rule evaluation — memoised so we only recompute when
  // the password field actually changes (not on every re-render). Used
  // by the checklist UI + the submit-button disabled state.
  const passwordRules = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, met: r.test(password) })),
    [password]
  );
  const passwordValid = passwordRules.every((r) => r.met);
  const passwordsMatch = !isSignup || password === confirmPassword;
  // The checklist is only relevant during signup; showing it on the
  // login form would be visual noise for existing users who set their
  // password before the policy was tightened.
  const showChecklist = isSignup && (passwordFocused || password.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  // Client-side pre-flight — mirrors server-side rules from
  // lib/password-policy.ts. Avoids a network round-trip when the user
  // hasn't met all rules yet.
  if (isSignup) {
    const check = validatePassword(password);
    if (!check.valid) {
      setError(check.error);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please re-type your password.");
      return;
    }
  }

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
      const msg = result.error === "CredentialsSignin"
        ? "Invalid email or password"
        : result.error;
      setError(msg);
      toast.error(msg);
    } else {
      if (isSignup) {
        // GA4 conversion — V13.1 signup_completed (fires at row-creation
        // time, not verification time — this measures signup CTA
        // conversion, not activated-user rate).
        trackEvent({
          name: "signup_completed",
          params: { method: "credentials" },
        });
        // No celebratory toast on signup — the account isn't usable until
        // the user clicks the verification link in their email. Showing
        // "Account created! Welcome 🎉" here was misleading; the
        // /verify-email-pending page (where the dashboard redirect lands
        // them) already communicates the correct next step. Reported
        // 2026-09-16.
        router.push(callbackUrl);
      } else {
        toast.success("Welcome back!");
        router.push(callbackUrl);
      }
    }
  } catch {
    setError("Something went wrong. Please try again.");
    toast.error("Something went wrong. Please try again.");
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
 <div className="relative min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">

    <div className="absolute top-4 right-4">
      <ThemeToggle />
    </div>

    <div className="w-full" style={{ maxWidth: 440 }}>
      <div className="mb-5 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
          <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600"
            style={{ width: 40, height: 40 }}>
            <Send className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">DM Shiyam</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isSignup
            ? "Start automating your Instagram DMs today"
            : "Sign in to manage your automations"}
        </p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-700"
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
              <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Name</label>
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
            <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                style={{ border: "1.5px solid #9ca3af", borderRadius: 12, padding: "12px 44px 12px 40px", background: "#f9fafb" }}
                placeholder={isSignup ? "Create a strong password" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                minLength={isSignup ? 8 : undefined}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isSignup && (
              <div className="text-right mt-1.5">
                <Link href="/forgot-password" className="text-xs text-purple-600 hover:text-purple-700">
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Live password strength checklist — only shown during signup
                once the user has interacted with the password field. Each
                rule turns green with a check when met, greyscale with a
                dash when unmet. Users get instant feedback rather than a
                server-side rejection after clicking Create Account. */}
            {showChecklist && (
              <ul className="mt-2 space-y-1 rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 text-xs">
                {passwordRules.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    {r.met ? (
                      <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={r.met ? "text-green-700" : "text-gray-500"}>
                      {r.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Confirm password — only on signup, to catch typos before
              the account is created. Server-side does NOT re-check this
              (it only sees one password field), so client-side is the
              only line of defence against a mistyped password locking
              the user out on next login. */}
          {isSignup && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
                  style={{
                    border: `1.5px solid ${confirmPassword && !passwordsMatch ? "#ef4444" : "#9ca3af"}`,
                    borderRadius: 12,
                    padding: "12px 16px 12px 40px",
                    background: "#f9fafb",
                  }}
                  placeholder="Re-type your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={isSignup}
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-red-600">
                  Passwords don&apos;t match.
                </p>
              )}
            </div>
          )}

          {error && (
            <div style={{ border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 16px", background: "#fef2f2" }}
              className="text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              // On signup, block submit until all password rules pass +
              // both password fields agree. On login, only block on the
              // in-flight state (existing users may have pre-policy
              // passwords that don't satisfy every new rule).
              (isSignup && (!passwordValid || !passwordsMatch))
            }
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