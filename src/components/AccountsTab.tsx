"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Instagram,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  CheckCircle2,
  Key,
  User,
  Hash,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import type { Account } from "@/types";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Instagram did not return an authorization code. Please try again.",
  bad_state: "Session expired or invalid. Please try connecting again.",
  misconfigured: "Instagram app credentials are not configured on the server.",
  code_exchange_failed: "Instagram rejected the authorization code.",
  code_exchange_error: "Network error while contacting Instagram. Please retry.",
  long_lived_failed: "Could not obtain a long-lived access token.",
  long_lived_error: "Network error while extending the access token.",
  profile_fetch_failed: "Could not read your Instagram profile.",
  profile_fetch_error: "Network error while reading your Instagram profile.",
  already_connected: "This Instagram account is already connected to another DM Shiyam user.",
  persist_failed: "Could not save the connected account.",
  access_denied: "You cancelled the Instagram authorization.",
};

const OAUTH_WARNING_MESSAGES: Record<string, string> = {
  subscription_failed:
    "Account connected, but webhook subscription failed — comments won't trigger DMs. Try Reconnect to retry.",
};

export default function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      setAccounts(await res.json());
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Surface OAuth callback outcomes as toasts, then strip the query params.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("ig_connected");
    const err = params.get("ig_error");
    if (!connected && !err) return;

    if (connected) {
      const username = params.get("username");
      toast.success(
        username
          ? `Connected @${username} successfully`
          : "Instagram account connected"
      );
      // Additionally check for a warning (subscription failure, etc.)
      const warn = params.get("ig_warn");
      if (warn) {
        const warnMsg =
          OAUTH_WARNING_MESSAGES[warn] ||
          params.get("ig_error_desc") ||
          "Connected with a non-fatal warning.";
        toast.warning(warnMsg, { duration: 8000 });
      }
    } else if (err) {
      const msg =
        OAUTH_ERROR_MESSAGES[err] ||
        params.get("ig_error_desc") ||
        "Failed to connect Instagram account";
      toast.error(msg);
    }

    // Clean URL so refresh doesn't re-trigger the toast
    params.delete("ig_connected");
    params.delete("ig_error");
    params.delete("ig_error_desc");
    params.delete("ig_warn");
    params.delete("username");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
  }, []);

  const startInstagramOAuth = () => {
    window.location.href = "/api/instagram/oauth/authorize";
  };

  const handleToggle = async (account: Account) => {
  await fetch("/api/accounts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
  });
  toast.success(account.is_active ? "Account paused" : "Account activated");
  fetchAccounts();
};

const handleDelete = async (id: string) => {
  if (!confirm("Disconnect this account? Automations linked to it will be unlinked.")) return;
  await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
  toast.success("Account disconnected");
  fetchAccounts();
};


  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading accounts...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Connected Accounts ({accounts.length})
        </h2>
        <button
          onClick={startInstagramOAuth}
          className="btn-primary !py-2"
        >
          <Instagram className="h-4 w-4" />
          Connect Instagram
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="card py-16 text-center">
          <Instagram className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-semibold text-gray-700">
            No accounts connected
          </h3>
          <p className="mb-6 text-sm text-gray-500">
            Click below to sign in with Instagram. You&apos;ll be redirected to Meta&apos;s
            official OAuth screen to grant access.
          </p>
          <button onClick={startInstagramOAuth} className="btn-primary">
            <Instagram className="h-4 w-4" /> Connect Instagram
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`card flex items-center justify-between transition-all ${
                !account.is_active ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
                  <Instagram className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">@{account.instagram_username}</h3>
                    {account.is_active ? (
                      <span className="badge-success">Active</span>
                    ) : (
                      <span className="badge-error">Paused</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    ID: {account.instagram_account_id} &middot; Token: {account.access_token}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(account)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  title={account.is_active ? "Pause" : "Activate"}
                >
                  {account.is_active ? (
                    <ToggleRight className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Disconnect"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="card mt-6 bg-blue-50 border-blue-200">
        <h3 className="mb-2 font-semibold text-blue-800">How Multi-Account Works</h3>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>1. Connect multiple Instagram Business/Creator accounts here</li>
          <li>2. When creating automations, assign them to a specific account</li>
          <li>3. Webhooks auto-route to the correct account based on the Instagram Account ID</li>
          <li>4. Each account uses its own access token for API calls</li>
        </ul>
      </div>

      {/* Advanced: manual paste of access token (dev / recovery only) */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
          Advanced: paste access token manually
        </button>
        {showAdvanced && (
          <div className="mt-3">
            <p className="mb-3 text-xs text-gray-500">
              Only use this if the OAuth flow above doesn&apos;t work (e.g. sandbox
              testing with a manually generated token).
            </p>
            <AccountForm
              onSave={() => {
                setShowAdvanced(false);
                fetchAccounts();
              }}
              onCancel={() => setShowAdvanced(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AccountForm({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  const [igAccountId, setIgAccountId] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagram_account_id: igAccountId,
          instagram_username: igUsername.replace("@", ""),
          access_token: accessToken,
          page_id: pageId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || "Failed to connect account";
setError(errMsg);
toast.error(errMsg);
        return;
      }
      toast.success("Account connected successfully!");
onSave();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-4">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
              <User className="h-3.5 w-3.5" /> Instagram Username
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="yourusername"
              value={igUsername}
              onChange={(e) => setIgUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
              <Hash className="h-3.5 w-3.5" /> Instagram Account ID
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="17841400123456789"
              value={igAccountId}
              onChange={(e) => setIgAccountId(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
            <Key className="h-3.5 w-3.5" /> Access Token
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              className="input-field !pr-10"
              placeholder="EAAxxxxxxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 text-sm font-medium text-gray-700">
            Facebook Page ID <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="123456789012345"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Connect Account
          </button>
        </div>
      </div>
    </form>
  );
}
