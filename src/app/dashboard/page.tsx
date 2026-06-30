"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import OnboardingWizard from "@/components/OnboardingWizard";
import { toast } from "sonner";
import {
  Send,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MessageCircle,
  Activity,
  Zap,
  Hash,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Pencil,
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Brain,
  Instagram,
  Sparkles,
  Users,
  LogOut,
  Crown,
} from "lucide-react";
import type { Automation, ActivityLog, DashboardStats, Account } from "@/types";
import AnalyticsTab from "@/components/AnalyticsTab";
import AccountsTab from "@/components/AccountsTab";

type Tab = "automations" | "activity" | "analytics" | "accounts" | "setup";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("automations");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [autoRes, actRes, statsRes, accRes] = await Promise.all([
        fetch("/api/automations"),
        fetch("/api/activity?limit=30"),
        fetch("/api/stats"),
        fetch("/api/accounts"),
      ]);
      setAutomations(await autoRes.json());
      setActivities(await actRes.json());
      setStats(await statsRes.json());
      setAccounts(await accRes.json());
    } catch (err) {
      console.error("Failed to fetch data:", err);
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

    // Poll non-activity data less frequently (stats, automations) since SSE
    // only covers new activity log entries
    const interval = setInterval(fetchData, 30000);

    const es = new EventSource("/api/activity/stream");
    es.onmessage = (event) => {
      try {
        const newActivity = JSON.parse(event.data);
        setActivities((prev) => [newActivity, ...prev].slice(0, 50));
        toast.success(`New activity: @${newActivity.instagram_username}`);
        fetchData(); // refresh stats too since a new DM affects counts
      } catch {
        // ignore comment/heartbeat lines, they don't reach onmessage anyway
      }
    };
    es.onerror = () => {
      console.warn("SSE connection error, browser will auto-reconnect");
    };

    return () => {
      clearInterval(interval);
      es.close();
    };
  }
}, [fetchData, status, router]);

useEffect(() => {
  if (status === "authenticated" && !loading && automations.length === 0 && !onboardingDismissed) {
    setShowOnboarding(true);
  }
}, [status, loading, automations, onboardingDismissed]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!session) return null;

  const userPlan = (session.user as Record<string, unknown>)?.plan as string || "free";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
                <Send className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold dark:text-white">DM Shiyam</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userPlan !== "free" && (
              <span className="hidden sm:inline-flex items-center gap-1 badge bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200">
                <Crown className="h-3 w-3" /> {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
              </span>
            )}
            {stats && stats.accounts_connected > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-blue-600">
                <Users className="h-3.5 w-3.5" />
                {stats.accounts_connected} account{stats.accounts_connected > 1 ? "s" : ""}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600">
  <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />
  Webhook Active
</div>
            <ThemeToggle />
<button onClick={fetchData} className="btn-secondary !px-3 !py-2">
  <RefreshCw className="h-4 w-4" />
</button>
            <button onClick={fetchData} className="btn-secondary !px-3 !py-2">
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="hidden sm:block text-xs text-gray-500 truncate max-w-[120px]">{session.user?.email}</span>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Cards */}
        {stats && <StatsGrid stats={stats} />}

        {/* Tabs */}
       <div
  className="mb-6 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 scrollbar-hide"
  style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexWrap: "nowrap" }}
>
  {[
    { id: "automations" as Tab, label: "Automations", icon: Zap },
    { id: "activity" as Tab, label: "Activity", icon: Activity },
    { id: "analytics" as Tab, label: "Analytics", icon: BarChart3 },
    { id: "accounts" as Tab, label: "Accounts", icon: Instagram },
    { id: "setup" as Tab, label: "Setup", icon: Hash },
  ].map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all flex-shrink-0 ${
        activeTab === tab.id
          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      <tab.icon className="h-4 w-4 flex-shrink-0" />
      <span className="hidden sm:inline">{tab.label}</span>
      <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
    </button>
  ))}
</div>

        {/* Tab Content */}
        {activeTab === "automations" && (
          <AutomationsTab
            automations={automations}
            accounts={accounts}
            loading={loading}
            showCreateForm={showCreateForm}
            setShowCreateForm={setShowCreateForm}
            editingId={editingId}
            setEditingId={setEditingId}
            onRefresh={fetchData}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab activities={activities} loading={loading} />
        )}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "accounts" && <AccountsTab />}
        {activeTab === "setup" && <SetupGuide />}
      </main>

      {showOnboarding && (
  <OnboardingWizard
    onClose={() => {
      setShowOnboarding(false);
      setOnboardingDismissed(true);
    }}
    onGoToAccounts={() => setActiveTab("accounts")}
    onGoToAutomations={() => setActiveTab("automations")}
  />
)}

    </div>
  );
}

// ── Stats Grid ──

function StatsGrid({ stats }: { stats: DashboardStats }) {
  const cards = [
  { label: "Total DMs Sent", value: stats.total_dms_sent, icon: Send, color: "text-pink-600 bg-pink-50" },
  { label: "Active Automations", value: stats.active_automations, icon: Activity, color: "text-emerald-600 bg-emerald-50" },
  { label: "DMs Today", value: stats.dms_today, icon: Zap, color: "text-purple-600 bg-purple-50" },
  { label: "This Week", value: stats.dms_this_week, icon: BarChart3, color: "text-blue-600 bg-blue-50" },
  { label: "AI Replies", value: stats.ai_replies, icon: Brain, color: "text-violet-600 bg-violet-50" },
  { label: "Accounts", value: stats.accounts_connected, icon: Instagram, color: "text-pink-600 bg-pink-50" },
];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 w-full">
      {cards.map((card) => (
        <div key={card.label} className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {card.label}
            </span>
            <div className={`rounded-lg p-1.5 ${card.color}`}>
              <card.icon className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}


function TemplateSelector({ onSelect }: { onSelect: (template: Partial<Automation>) => void }) {
  const templates = [
    {
      icon: "🧲",
      label: "Lead Magnet",
      description: "Send a free guide or resource",
      data: {
        name: "Lead Magnet",
        trigger_keywords: "guide, free, send, info",
        dm_message: "Hey {username}! 👋\n\nThanks for your interest! Here's your free guide:\nhttps://yourlink.com/guide\n\nLet me know if you have any questions!",
        reply_comment: "Just sent it to your DMs! 📩",
      },
    },
    {
      icon: "🏷️",
      label: "Discount Code",
      description: "Share a promo code via DM",
      data: {
        name: "Discount Code",
        trigger_keywords: "discount, code, promo, deal, offer",
        dm_message: "Hey {username}! 🎉\n\nHere's your exclusive discount code: SAVE20\n\nUse it at checkout for 20% off:\nhttps://yourstore.com\n\nValid for 48 hours only!",
        reply_comment: "Sent you the code in your DMs! 🎁",
      },
    },
    {
      icon: "🔗",
      label: "Link in Bio",
      description: "Drive traffic to your link",
      data: {
        name: "Link in Bio",
        trigger_keywords: "link, website, shop, store",
        dm_message: "Hey {username}! ✨\n\nHere's the link you asked for:\nhttps://yourlink.com\n\nLet me know if you need anything else!",
        reply_comment: "Link sent to your DMs! 🔗",
      },
    },
  ];

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Quick start with a template
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.label}
            onClick={() => {
  console.log("Template selected:", t.data);
  onSelect(t.data as Partial<Automation>);
}}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-purple-300 hover:bg-purple-50 hover:shadow-sm"
          >
            <span className="text-2xl">{t.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{t.label}</p>
              <p className="text-xs text-gray-400">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1" style={{ borderTop: "1px solid #e5e7eb" }} />
        <span className="text-xs text-gray-400">or start from scratch</span>
        <div className="flex-1" style={{ borderTop: "1px solid #e5e7eb" }} />
      </div>
    </div>
  );
}

// ── Automations Tab ──

function AutomationsTab({
  automations,
  accounts,
  loading,
  showCreateForm,
  setShowCreateForm,
  editingId,
  setEditingId,
  onRefresh,
}: {
  automations: Automation[];
  accounts: Account[];
  loading: boolean;
  showCreateForm: boolean;
  setShowCreateForm: (v: boolean) => void;
  editingId: string | null;
  setEditingId: (v: string | null) => void;
  onRefresh: () => void;
}) {

  const [selectedTemplate, setSelectedTemplate] = useState<Partial<Automation> | null>(null); // 
  const handleToggle = async (automation: Automation) => {
  await fetch("/api/automations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: automation.id, is_active: !automation.is_active }),
  });
  toast.success(automation.is_active ? "Automation paused" : "Automation activated");
  onRefresh();
};

  const handleDelete = async (id: string) => {
  if (!confirm("Delete this automation? This cannot be undone.")) return;
  await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
  toast.success("Automation deleted");
  onRefresh();
};

  return (
  <div>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold dark:text-white">
        Your Automations ({automations.length})
      </h2>
      <button
        onClick={() => { setShowCreateForm(!showCreateForm); setEditingId(null); setSelectedTemplate(null); }}
        className="btn-primary !py-2"
      >
        {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {showCreateForm ? "Cancel" : "New Automation"}
      </button>
    </div>

    {showCreateForm && (
      <>
        <TemplateSelector onSelect={(template) => setSelectedTemplate(template)} />
        <div className="card mb-4">
          <AutomationForm
            key={selectedTemplate?.name ?? "empty"}
            template={selectedTemplate ?? undefined}
            accounts={accounts}
            onSave={() => {
              setShowCreateForm(false);
              setSelectedTemplate(null);
              onRefresh();
            }}
            onCancel={() => {
              setShowCreateForm(false);
              setSelectedTemplate(null);
            }}
          />
        </div>
      </>
    )}

    {loading ? (
      <div className="card flex items-center justify-center py-12 text-gray-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
      </div>
    ) : automations.length === 0 ? (
      <div className="card py-16 text-center">
        <Zap className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h3 className="mb-2 text-lg font-semibold text-gray-700">No automations yet</h3>
        <p className="mb-6 text-sm text-gray-500">Create your first automation to start sending DMs automatically.</p>
        <button onClick={() => setShowCreateForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Create Automation
        </button>
      </div>
    ) : (
      <div className="space-y-3">
        {automations.map((auto) => (
          <AutomationCard
            key={auto.id}
            automation={auto}
            accounts={accounts}
            isEditing={editingId === auto.id}
            onEdit={() => setEditingId(editingId === auto.id ? null : auto.id)}
            onToggle={() => handleToggle(auto)}
            onDelete={() => handleDelete(auto.id)}
            onSave={() => { setEditingId(null); onRefresh(); }}
          />
        ))}
      </div>
    )}
  </div>
);
}

// ── Automation Card ──

function AutomationCard({
  automation,
  accounts,
  isEditing,
  onEdit,
  onToggle,
  onDelete,
  onSave,
}: {
  automation: Automation;
  accounts: Account[];
  isEditing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const linkedAccount = accounts.find((a) => a.id === automation.account_id);

  return (
    <div className={`card transition-all ${!automation.is_active ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold truncate dark:text-white">{automation.name}</h3>
            {automation.is_active ? <span className="badge-success">Active</span> : <span className="badge-error">Paused</span>}
            {automation.ai_enabled && (
              <span className="badge bg-violet-50 text-violet-700 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
            {linkedAccount && (
              <span className="badge bg-pink-50 text-pink-700">@{linkedAccount.instagram_username}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="flex items-center gap-1 dark:text-gray-400">
              <Hash className="h-3.5 w-3.5" />
              {automation.trigger_keywords.split(",").map((k) => (
                <span key={k} className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {k.trim()}
                </span>
              ))}
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1 dark:text-gray-400">
              <Send className="h-3.5 w-3.5" />
              {automation.total_triggered} triggered
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600" title="Expand">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={onToggle} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600" title={automation.is_active ? "Pause" : "Activate"}>
            {automation.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5" />}
          </button>
          <button onClick={onEdit} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-blue-600" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">DM Message {automation.ai_enabled && "(used as AI context/fallback)"}</p>
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">{automation.dm_message}</p>
          </div>
          {automation.reply_comment && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Auto Comment Reply</p>
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{automation.reply_comment}</p>
            </div>
          )}
          {automation.ai_enabled && automation.ai_system_prompt && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">AI System Prompt</p>
              <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-700 whitespace-pre-wrap">{automation.ai_system_prompt}</p>
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <AutomationForm initial={automation} accounts={accounts} onSave={onSave} onCancel={onEdit} />
        </div>
      )}
    </div>
  );
}

// ── Automation Form (with AI + Account fields) ──

function AutomationForm({
  initial,
  template,
  accounts,
  onSave,
  onCancel,
}: {
  initial?: Automation;
  template?: Partial<Automation>;
  accounts: Account[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || template?.name || "");
const [keywords, setKeywords] = useState(initial?.trigger_keywords || template?.trigger_keywords || "");
const [dmMessage, setDmMessage] = useState(initial?.dm_message || template?.dm_message || "");
const [replyComment, setReplyComment] = useState(initial?.reply_comment || template?.reply_comment || "");
const [accountId, setAccountId] = useState(initial?.account_id || "");
const [aiEnabled, setAiEnabled] = useState(initial?.ai_enabled || false);
const [aiSystemPrompt, setAiSystemPrompt] = useState(initial?.ai_system_prompt || "");
const [saving, setSaving] = useState(false);

// ← add this right after all the useState lines
useEffect(() => {
   console.log("useEffect fired, template:", template); // ← add
  if (template) {
    setName(template.name || "");
    setKeywords(template.trigger_keywords || "");
    setDmMessage(template.dm_message || "");
    setReplyComment(template.reply_comment || "");
  }
}, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  try {
    const body = {
      ...(initial ? { id: initial.id } : {}),
      name,
      trigger_keywords: keywords,
      dm_message: dmMessage,
      reply_comment: replyComment || undefined,
      account_id: accountId || undefined,
      ai_enabled: aiEnabled,
      ai_system_prompt: aiEnabled ? aiSystemPrompt || undefined : undefined,
    };
    const res = await fetch("/api/automations", {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to save");
    toast.success(initial ? "Automation updated" : "Automation created!");
    onSave();
  } catch {
    toast.error("Something went wrong. Please try again.");
  } finally {
    setSaving(false);
  }
};

  return (
    <form onSubmit={handleSubmit} className="">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Automation Name</label>
            <input type="text" className="input-field" placeholder='"Free Guide Funnel"' value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Instagram Account</label>
            <select className="input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Default (env vars)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>@{a.instagram_username}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Trigger Keywords <span className="text-xs text-gray-400">(comma-separated)</span>
          </label>
          <input type="text" className="input-field" placeholder='"INFO, LINK, GUIDE, SEND"' value={keywords} onChange={(e) => setKeywords(e.target.value)} required />
          <p className="mt-1 text-xs text-gray-400">Bot triggers when a comment contains any of these words</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            DM Message <span className="text-xs text-gray-400">(use {"{username}"} for personalization)</span>
          </label>
          <textarea className="textarea-field" rows={4} placeholder={`Hey {username}!\n\nThanks for your interest! Here's the link:\nhttps://example.com/guide`} value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} required />
          {aiEnabled && <p className="mt-1 text-xs text-violet-500">With AI enabled, this is used as context/fallback. AI will personalize based on the comment.</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Auto Comment Reply <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <textarea className="textarea-field" rows={2} placeholder='"Just sent it to your DMs!"' value={replyComment} onChange={(e) => setReplyComment(e.target.value)} />
        </div>

        {/* AI Toggle */}
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="font-medium text-sm">AI Smart Replies</p>
                <p className="text-xs text-gray-500">Use GPT to generate personalized DMs based on each comment</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiEnabled(!aiEnabled)}
              className="transition-colors"
            >
              {aiEnabled ? (
                <ToggleRight className="h-7 w-7 text-violet-600" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-gray-400" />
              )}
            </button>
          </div>

          {aiEnabled && (
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-violet-700">
                AI System Prompt <span className="text-xs text-violet-400">(optional — customize AI behavior)</span>
              </label>
              <textarea
                className="textarea-field !border-violet-200 !bg-white focus:!border-violet-400 focus:!ring-violet-100"
                rows={3}
                placeholder="You are a friendly fitness coach. When someone comments, send them a personalized DM with workout tips and a link to your free program..."
                value={aiSystemPrompt}
                onChange={(e) => setAiSystemPrompt(e.target.value)}
              />
              <p className="mt-1 text-xs text-violet-400">
                Requires OPENAI_API_KEY in your .env.local. Uses gpt-4o-mini (~$0.15 per 1M tokens).
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {initial ? "Update" : "Create"} Automation
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Activity Tab ──

function ActivityTab({ activities, loading }: { activities: ActivityLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12 text-gray-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card py-16 text-center">
        <Activity className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h3 className="mb-2 text-lg font-semibold text-gray-700">No activity yet</h3>
        <p className="text-sm text-gray-500">Activity will appear here once your automations start triggering.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((log) => (
        <div key={log.id} className="card !py-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-1.5 ${log.dm_sent ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
              {log.dm_sent ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-sm">@{log.instagram_username}</span>
                <span className="text-gray-300">&middot;</span>
                <span className="badge-info">{log.matched_keyword}</span>
                {log.ai_generated && (
                  <span className="badge bg-violet-50 text-violet-700 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI
                  </span>
                )}
                <span className="text-gray-300">&middot;</span>
                <span className="text-xs text-gray-400">{log.automation_name}</span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                <MessageCircle className="mr-1 inline h-3.5 w-3.5" />
                &ldquo;{log.comment_text}&rdquo;
              </p>
              <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap">
                {log.dm_sent ? <span className="text-emerald-600">DM sent</span> : <span className="text-red-500">DM failed</span>}
                {log.comment_replied && <span className="text-blue-600">Comment replied</span>}
                <span className="flex items-center gap-1 text-gray-400">
                  <Clock className="h-3 w-3" />
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              {log.error_message && <p className="mt-1 text-xs text-red-400">{log.error_message}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Setup Guide ──

function SetupGuide() {
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold">Instagram API Setup Guide</h3>
        <div className="space-y-6">
          {[
            { step: 1, title: "Create a Meta Developer Account", content: 'Go to developers.facebook.com and create an account. Click "Create App" and select "Business" type.' },
            { step: 2, title: "Switch to Instagram Business/Creator Account", content: "In the Instagram app, go to Settings > Account > Switch to Professional Account. Link it to a Facebook Page." },
            { step: 3, title: "Add Instagram Product to Your App", content: 'In the Meta Developer dashboard, add the "Instagram" product. Configure the Instagram Graph API.' },
            { step: 4, title: "Generate Access Token", content: "Use the Graph API Explorer to generate a User Access Token with permissions: instagram_manage_comments, instagram_manage_messages, pages_manage_metadata, pages_messaging." },
            { step: 5, title: "Set Up Webhooks", content: "In your app settings, add a Webhook subscription for Instagram. Set the callback URL to YOUR_DOMAIN/api/webhook/instagram and use the WEBHOOK_VERIFY_TOKEN from your .env file." },
            { step: 6, title: "Subscribe to Comments", content: 'In the Webhooks settings, subscribe to the "comments" field. This will send real-time notifications when someone comments on your posts.' },
            { step: 7, title: "Configure Environment Variables", content: "Copy .env.example to .env.local and fill in your credentials. For AI, add your OPENAI_API_KEY." },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">{item.step}</div>
              <div>
                <h4 className="font-medium">{item.title}</h4>
                <p className="mt-1 text-sm text-gray-500">{item.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-violet-50 border-violet-200">
        <h3 className="mb-2 font-semibold text-violet-800">AI Smart Replies Setup</h3>
        <ul className="space-y-1 text-sm text-violet-700">
          <li>1. Get an API key from <strong>platform.openai.com</strong></li>
          <li>2. Add <code className="bg-violet-100 px-1 rounded">OPENAI_API_KEY=sk-...</code> to your .env.local</li>
          <li>3. Enable AI on any automation via the toggle in the form</li>
          <li>4. Optionally customize the AI system prompt per automation</li>
          <li>5. Cost: ~$0.15 per 1M tokens (gpt-4o-mini) — roughly $0.0001 per DM</li>
        </ul>
      </div>

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="mb-2 font-semibold text-blue-800">Multi-Account Setup</h3>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>1. Go to the <strong>Accounts</strong> tab and click "Connect Account"</li>
          <li>2. Enter the Instagram Account ID, username, and access token</li>
          <li>3. When creating automations, select which account to use</li>
          <li>4. Webhooks auto-route based on the Instagram Account ID in the payload</li>
        </ul>
      </div>

      <div className="card bg-amber-50 border-amber-200">
        <h3 className="mb-2 font-semibold text-amber-800">Important Notes</h3>
        <ul className="space-y-1 text-sm text-amber-700">
          <li>- Your app must be publicly accessible (use ngrok for local dev)</li>
          <li>- Access tokens expire — set up token refresh for production</li>
          <li>- Instagram DMs only work if the user has interacted with your account</li>
          <li>- For production, submit your app for Meta App Review</li>
        </ul>
      </div>


      
    </div>

    
  );
}
