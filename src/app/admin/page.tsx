"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  BarChart3,
  Shield,
  Send,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Crown,
  Trash2,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  Instagram,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  UserPlus,
} from "lucide-react";
import type { AdminStats, User, FunnelStats } from "@/types";

type Tab = "overview" | "users" | "errors" | "feedback" | "webhooks";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  rating: "up" | "down";
  comment: string | null;
  source: string;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"created_at" | "dms_used_this_month" | "plan">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const userRole = (session?.user as Record<string, unknown>)?.role as string;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        setError("Access denied. Admin role required.");
        setLoading(false);
        return;
      }

      if (!statsRes.ok || !usersRes.ok) {
        setError("Failed to load admin data.");
        setLoading(false);
        return;
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router, fetchData]);

  const handleUpdateUser = async (
    targetUserId: string,
    data: { plan?: string; dm_limit?: number; dms_used_this_month?: number; role?: string }
  ) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update user");
        return;
      }
      fetchData();
      setEditingUser(null);
    } catch {
      alert("Network error");
    }
  };

  const handleDeleteUser = async (targetUserId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete user");
        return;
      }
      fetchData();
    } catch {
      alert("Network error");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "created_at") return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sortField === "dms_used_this_month") return dir * (a.dms_used_this_month - b.dms_used_this_month);
    if (sortField === "plan") return dir * a.plan.localeCompare(b.plan);
    return 0;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <Link href="/dashboard" className="text-purple-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-600">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold dark:text-white">Admin Panel</span>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {userRole}
              </span>
            </div>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Revenue Metrics (P23.1) */}
        {stats && <RevenueGrid stats={stats} />}

        {/* Stats Overview */}
        {stats && <StatsGrid stats={stats} />}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {[
            { id: "overview" as Tab, label: "Overview", icon: BarChart3 },
            { id: "users" as Tab, label: `Users (${users.length})`, icon: Users },
            { id: "errors" as Tab, label: "Errors", icon: AlertTriangle },
            { id: "feedback" as Tab, label: "Feedback", icon: MessageSquare },
            { id: "webhooks" as Tab, label: "Webhooks", icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && stats && <OverviewTab stats={stats} users={users} />}
        {activeTab === "users" && (
          <UsersTab
            users={sortedUsers}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
            sortField={sortField}
            sortDir={sortDir}
            toggleSort={toggleSort}
            currentUserId={(session?.user as Record<string, unknown>)?.id as string}
          />
        )}
        {activeTab === "errors" && stats && <ErrorsTab stats={stats} />}
        {activeTab === "feedback" && <FeedbackTab />}
        {activeTab === "webhooks" && <WebhookHealthTab />}
      </main>
    </div>
  );
}

// ── Revenue Grid (P23.1) ──
// Displays MRR, ARR, active subs, ARPU, churn, and trialing users.
// Prices are stored in paise (₹1 = 100 paise), formatted for display in ₹.

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function RevenueGrid({ stats }: { stats: AdminStats }) {
  const cards = [
    {
      label: "MRR",
      value: formatRupees(stats.mrr_paise),
      sub: `ARR: ${formatRupees(stats.arr_paise)}`,
      icon: IndianRupee,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Active Subscribers",
      value: stats.active_subscribers.toLocaleString(),
      sub: stats.active_subscribers > 0
        ? `ARPU: ${formatRupees(stats.arpu_paise)}`
        : "No paying users yet",
      icon: Crown,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Trialing (14d)",
      value: stats.trialing_users.toLocaleString(),
      sub: "Free plan, joined <14d",
      icon: UserPlus,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Churned (30d)",
      value: stats.churned_last_30d.toLocaleString(),
      sub: stats.churned_last_30d === 0
        ? "No churn — nice"
        : "cancelled + expired",
      icon: stats.churned_last_30d === 0 ? TrendingUp : TrendingDown,
      color:
        stats.churned_last_30d === 0
          ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
          : "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-lg p-1.5 ${card.color}`}>
              <card.icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {card.label}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {card.value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Stats Grid ──

function StatsGrid({ stats }: { stats: AdminStats }) {
  const cards = [
    { label: "Total Users", value: stats.total_users, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Active (7d)", value: stats.active_users_7d, icon: Activity, color: "text-green-600 bg-green-50" },
    { label: "DMs Sent", value: stats.total_dms_sent, icon: Send, color: "text-purple-600 bg-purple-50" },
    { label: "DMs Today", value: stats.dms_today, icon: Zap, color: "text-amber-600 bg-amber-50" },
    { label: "Automations", value: stats.total_automations, icon: Zap, color: "text-indigo-600 bg-indigo-50" },
    { label: "Accounts", value: stats.total_accounts, icon: Instagram, color: "text-pink-600 bg-pink-50" },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-lg p-1.5 ${card.color}`}>
              <card.icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{card.label}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

// ── A9.1 Onboarding Funnel Widget ──
// Reads /api/admin/funnel (admin-only) and shows per-stage drop-off + median
// time-to-activation. Cheap to render on Overview since it's a single row.
function humanDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(seconds / 3600);
  if (h < 48) return `${h}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function FunnelWidget() {
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/funnel");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FunnelStats;
        if (!cancelled) setFunnel(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-4 lg:col-span-2 text-sm text-rose-700 dark:text-rose-300">
        Failed to load funnel: {err}
      </div>
    );
  }
  if (!funnel) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 lg:col-span-2">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading funnel…
        </div>
      </div>
    );
  }

  const stages: Array<{
    label: string;
    count: number;
    pct: number;
    from?: string;
    median?: number | null;
  }> = [
    {
      label: "Signed up",
      count: funnel.total_signups,
      pct: 100,
    },
    {
      label: "Connected IG",
      count: funnel.reached_account_connected,
      pct: funnel.pct_account_connected,
      from: "signup",
      median: funnel.median_seconds_signup_to_account,
    },
    {
      label: "Created automation",
      count: funnel.reached_automation_created,
      pct: funnel.pct_automation_created,
      from: "connect",
      median: funnel.median_seconds_account_to_automation,
    },
    {
      label: "First DM sent",
      count: funnel.reached_first_dm_sent,
      pct: funnel.pct_first_dm_sent,
      from: "automation",
      median: funnel.median_seconds_automation_to_first_dm,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 lg:col-span-2">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Onboarding Funnel
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Signup → account connected → automation created → first DM. Medians
            below each arrow show typical time between stages.
          </p>
        </div>
        {funnel.median_seconds_signup_to_first_dm != null && (
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Median signup → first DM
            </p>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {humanDuration(funnel.median_seconds_signup_to_first_dm)}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {stages.map((s, idx) => (
          <div key={s.label} className="flex items-stretch flex-1 min-w-[140px]">
            <div className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {s.label}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {s.count.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {s.pct}% of signups
              </p>
              {idx > 0 && s.median != null && (
                <p className="text-[10px] text-gray-400 mt-1">
                  median from {s.from}: {humanDuration(s.median)}
                </p>
              )}
            </div>
            {idx < stages.length - 1 && (
              <div className="flex items-center px-1 text-gray-300 dark:text-gray-600">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({ stats, users }: { stats: AdminStats; users: User[] }) {
  const successRate = stats.total_dms_sent + stats.total_dms_failed > 0
    ? ((stats.total_dms_sent / (stats.total_dms_sent + stats.total_dms_failed)) * 100).toFixed(1)
    : "0";

  const recentUsers = users.slice(0, 5);

  // P23.2: elevate error count to a first-class widget so it's visible
  // above the fold on the Overview tab. Threshold: 10 errors/24h = warn,
  // 50 = critical (matches Sentry alert rules in docs/SENTRY_SETUP.md).
  const errorSeverity: "ok" | "warn" | "critical" =
    stats.errors_last_24h >= 50
      ? "critical"
      : stats.errors_last_24h >= 10
        ? "warn"
        : "ok";
  const errorColor =
    errorSeverity === "critical"
      ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30"
      : errorSeverity === "warn"
        ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
        : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30";
  const errorTextColor =
    errorSeverity === "critical"
      ? "text-rose-700 dark:text-rose-300"
      : errorSeverity === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Meta API Errors (last 24h) — P23.2 */}
      <div className={`rounded-xl border-2 p-6 lg:col-span-2 ${errorColor}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className={`flex items-center gap-2 text-sm font-semibold mb-1 ${errorTextColor}`}>
              <AlertTriangle className="h-4 w-4" />
              Meta API Errors — Last 24h
            </div>
            <p className={`text-3xl font-bold ${errorTextColor}`}>
              {stats.errors_last_24h.toLocaleString()}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {stats.errors_last_7d.toLocaleString()} in last 7 days
              {" · "}
              {errorSeverity === "critical"
                ? "🚨 Investigate now — likely token expiry or Meta outage"
                : errorSeverity === "warn"
                  ? "⚠️ Elevated — check Errors tab"
                  : "✅ Healthy"}
            </p>
          </div>
          <button
            onClick={() => {
              const el = document.querySelector('[data-tab="errors"]') as HTMLButtonElement | null;
              el?.click();
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            View Errors →
          </button>
        </div>
      </div>

      {/* A9.1 — Onboarding funnel (self-fetches from /api/admin/funnel) */}
      <FunnelWidget />

      {/* Plan Distribution */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Plan Distribution</h3>
        <div className="space-y-3">
          {stats.plans.map((p) => (
            <div key={p.plan} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{p.plan}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${(p.count / stats.total_users) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">{p.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DM Success Rate */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">DM Performance</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Success Rate</span>
            <span className="text-2xl font-bold text-green-600">{successRate}%</span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{stats.total_dms_sent} sent</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{stats.total_dms_failed} failed</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{stats.dms_today} today</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{stats.dms_this_week} this week</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Users</h3>
        <div className="space-y-2">
          {recentUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded capitalize">{user.plan}</span>
                <span className="text-xs text-gray-400">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ──

function UsersTab({
  users,
  editingUser,
  setEditingUser,
  onUpdate,
  onDelete,
  sortField,
  sortDir,
  toggleSort,
  currentUserId,
}: {
  users: User[];
  editingUser: string | null;
  setEditingUser: (id: string | null) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string, email: string) => void;
  sortField: string;
  sortDir: string;
  toggleSort: (field: "created_at" | "dms_used_this_month" | "plan") => void;
  currentUserId: string;
}) {
  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">User</th>
              <th className="px-4 py-3 font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort("plan")}>
                <span className="flex items-center gap-1">Plan <SortIcon field="plan" /></span>
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort("dms_used_this_month")}>
                <span className="flex items-center gap-1">DMs Used <SortIcon field="dms_used_this_month" /></span>
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort("created_at")}>
                <span className="flex items-center gap-1">Joined <SortIcon field="created_at" /></span>
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isEditing={editingUser === user.id}
                onEdit={() => setEditingUser(editingUser === user.id ? null : user.id)}
                onUpdate={onUpdate}
                onDelete={onDelete}
                isCurrentUser={user.id === currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({
  user,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
  isCurrentUser,
}: {
  user: User;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string, email: string) => void;
  isCurrentUser: boolean;
}) {
  const [plan, setPlan] = useState<string>(user.plan);
  const [dmLimit, setDmLimit] = useState(user.dm_limit);
  const [role, setRole] = useState<string>(user.role || "user");

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.name} {isCurrentUser && <span className="text-xs text-purple-500">(you)</span>}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === "admin" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
          }`}>
            {user.role || "user"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded capitalize">{user.plan}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {user.dms_used_this_month} / {user.dm_limit === -1 ? "∞" : user.dm_limit}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {new Date(user.created_at).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">
              {isEditing ? "Cancel" : "Edit"}
            </button>
            {!isCurrentUser && (
              <button onClick={() => onDelete(user.id, user.email)} className="text-gray-400 hover:text-red-500 ml-2">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isEditing && (
        <tr className="bg-blue-50/50 dark:bg-blue-900/10">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plan</label>
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700">
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                  <option value="agency">Agency</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">DM Limit</label>
                <input type="number" value={dmLimit} onChange={(e) => setDmLimit(Number(e.target.value))} className="text-xs border rounded px-2 py-1 w-20 dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={() => onUpdate(user.id, { plan, dm_limit: dmLimit, role })}
                className="mt-4 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Errors Tab ──

function ErrorsTab({ stats }: { stats: AdminStats }) {
  if (stats.recent_errors.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
        <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No errors!</h3>
        <p className="text-sm text-gray-500 mt-1">All DMs are being sent successfully.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-left">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-500">Error Message</th>
            <th className="px-4 py-3 font-medium text-gray-500">Count</th>
            <th className="px-4 py-3 font-medium text-gray-500">Last Seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
          {stats.recent_errors.map((err, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 break-all">{err.error_message}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-bold text-red-600">{err.count}</span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                {new Date(err.last_seen).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Feedback Tab (A14.2) ──────────────────────────────────────────────────

function FeedbackTab() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/feedback");
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setRows(data.feedback || []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Loading feedback…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-12 text-red-600">Failed to load: {error}</div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 py-16 text-center">
        <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h3 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
          No feedback yet
        </h3>
        <p className="text-sm text-gray-500">
          User feedback from the in-app prompt will appear here.
        </p>
      </div>
    );
  }

  const upCount = rows.filter((r) => r.rating === "up").length;
  const downCount = rows.length - upCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
            {rows.length}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            <ThumbsUp className="h-4 w-4" /> Positive
          </div>
          <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
            {upCount}
          </div>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20 p-4">
          <div className="flex items-center gap-1.5 text-sm text-rose-700 dark:text-rose-300">
            <ThumbsDown className="h-4 w-4" /> Negative
          </div>
          <div className="text-2xl font-semibold text-rose-700 dark:text-rose-300">
            {downCount}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Comment
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                When
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  {r.rating === "up" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                      <ThumbsUp className="h-4 w-4" /> Up
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 font-medium">
                      <ThumbsDown className="h-4 w-4" /> Down
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="text-gray-900 dark:text-white">
                    {r.user_name || "(no name)"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.user_email || "anonymous"}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-md">
                  {r.comment || <span className="text-gray-400 italic">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.source}</td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Webhook Health Tab ──
// Diagnoses "auto-DM stopped after Meta review" issues per-account:
// token expiry, webhook field subscription status (live-fetched from Meta),
// last DM sent time. One-click re-subscribe for any account.

type WebhookHealthResponse = {
  summary: { total: number; healthy: number; warning: number; critical: number };
  global_webhook: {
    last_received_at: string | null;
    last_event_type: string | null;
    total_received: number;
  } | null;
  accounts: Array<{
    account_id: string;
    user_id?: string;
    instagram_username: string;
    instagram_account_id: string;
    is_active: boolean;
    token: {
      expires_at: string | null;
      days_until_expiry: number | null;
      status: "ok" | "expiring_soon" | "expired" | "unknown";
    };
    subscription: {
      fields: string[];
      ok: boolean;
      missing: string[];
      error?: string;
    };
    last_dm_sent_at: string | null;
    overall: "healthy" | "warning" | "critical";
  }>;
};

function WebhookHealthTab() {
  const [data, setData] = useState<WebhookHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resubscribing, setResubscribing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/webhook-health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resubscribe(accountId: string, username: string) {
    if (!confirm(`Re-subscribe @${username} to webhook fields?`)) return;
    setResubscribing(accountId);
    try {
      const res = await fetch("/api/admin/webhook-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`✓ Re-subscribed @${username}`);
        await load();
      } else {
        alert(`✗ Failed: ${body.error?.message ?? body.error ?? `HTTP ${res.status}`}`);
      }
    } catch (e) {
      alert(`✗ ${e instanceof Error ? e.message : "Network error"}`);
    } finally {
      setResubscribing(null);
    }
  }

  if (loading && !data) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading webhook health…</div>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { summary, global_webhook, accounts } = data;
  const globalMins = global_webhook?.last_received_at
    ? Math.floor((Date.now() - new Date(global_webhook.last_received_at).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total accounts" value={summary.total} color="text-gray-700 dark:text-gray-300" />
        <SummaryCard label="Healthy" value={summary.healthy} color="text-emerald-600" />
        <SummaryCard label="Warning" value={summary.warning} color="text-amber-600" />
        <SummaryCard label="Critical" value={summary.critical} color="text-red-600" />
      </div>

      {/* Global webhook health */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Meta webhook endpoint</h3>
          <button
            onClick={load}
            className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {global_webhook ? (
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Last event received</div>
              <div className={`font-medium ${globalMins !== null && globalMins > 60 ? "text-amber-600" : "text-gray-900 dark:text-gray-100"}`}>
                {globalMins === null ? "never" : globalMins < 1 ? "just now" : `${globalMins} min ago`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last event type</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{global_webhook.last_event_type ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total events (all time)</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{global_webhook.total_received.toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            No webhook events received yet. Check Meta App Dashboard → Webhooks → Instagram.
          </div>
        )}
      </div>

      {/* Per-account table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Last DM sent</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No connected Instagram accounts yet.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot overall={a.overall} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">@{a.instagram_username}</div>
                      <div className="text-xs text-gray-500">
                        id: {a.instagram_account_id} {a.is_active ? "" : "• disabled"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TokenPill status={a.token.status} days={a.token.days_until_expiry} />
                </td>
                <td className="px-4 py-3">
                  {a.subscription.error ? (
                    <span className="text-xs text-red-600" title={a.subscription.error}>
                      error: {a.subscription.error.slice(0, 40)}
                    </span>
                  ) : a.subscription.ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {a.subscription.fields.join(", ")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <XCircle className="h-3 w-3" />
                      missing: {a.subscription.missing.join(", ") || "all fields"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                  {a.last_dm_sent_at ? new Date(a.last_dm_sent_at).toLocaleString() : "never"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => resubscribe(a.account_id, a.instagram_username)}
                    disabled={resubscribing === a.account_id}
                    className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    {resubscribing === a.account_id ? "Re-subscribing…" : "Re-subscribe"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function StatusDot({ overall }: { overall: "healthy" | "warning" | "critical" }) {
  const cls =
    overall === "healthy"
      ? "bg-emerald-500"
      : overall === "warning"
        ? "bg-amber-500"
        : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} title={overall} />;
}

function TokenPill({
  status,
  days,
}: {
  status: "ok" | "expiring_soon" | "expired" | "unknown";
  days: number | null;
}) {
  const label =
    status === "ok"
      ? `${days}d left`
      : status === "expiring_soon"
        ? `${days}d left`
        : status === "expired"
          ? "expired"
          : "unknown";
  const cls =
    status === "ok"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "expiring_soon"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : status === "expired"
          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
