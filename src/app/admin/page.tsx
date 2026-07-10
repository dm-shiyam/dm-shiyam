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
} from "lucide-react";
import type { AdminStats, User } from "@/types";

type Tab = "overview" | "users" | "errors";

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
        {/* Stats Overview */}
        {stats && <StatsGrid stats={stats} />}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {[
            { id: "overview" as Tab, label: "Overview", icon: BarChart3 },
            { id: "users" as Tab, label: `Users (${users.length})`, icon: Users },
            { id: "errors" as Tab, label: "Errors", icon: AlertTriangle },
          ].map((tab) => (
            <button
              key={tab.id}
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
      </main>
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

// ── Overview Tab ──

function OverviewTab({ stats, users }: { stats: AdminStats; users: User[] }) {
  const successRate = stats.total_dms_sent + stats.total_dms_failed > 0
    ? ((stats.total_dms_sent / (stats.total_dms_sent + stats.total_dms_failed)) * 100).toFixed(1)
    : "0";

  const recentUsers = users.slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
