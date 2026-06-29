// ── User & Subscription ──

export type PlanType = "free" | "starter" | "pro" | "business" | "agency";

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash?: string; // null for Google sign-in
  provider: "credentials" | "google";
  provider_id?: string; // Google sub ID
  plan: PlanType;
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
  subscription_status: "active" | "cancelled" | "expired" | "none";
  dm_limit: number; // per month
  dms_used_this_month: number;
  created_at: string;
  updated_at: string;
}

export interface PlanConfig {
  name: string;
  price_monthly: number; // in paise (₹1999 = 199900)
  price_label: string;
  dm_limit: number;
  max_automations: number;
  max_accounts: number;
  ai_enabled: boolean;
  analytics: boolean;
  features: string[];
}

// ── Multi-Account ──

export interface Account {
  id: string;
  user_id?: string;
  instagram_account_id: string;
  instagram_username: string;
  access_token: string;
  page_id?: string;
  token_expires_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Automations (with AI + account support) ──

export interface Automation {
  id: string;
  user_id?: string; // owning user
  account_id?: string; // linked Instagram account
  name: string;
  trigger_keywords: string; // comma-separated keywords
  dm_message: string; // message template, supports {username} placeholder
  reply_comment?: string; // optional auto-reply to the comment itself
  ai_enabled: boolean; // use GPT to generate DM instead of static message
  ai_system_prompt?: string; // custom instructions for AI
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_triggered: number;
}

// ── Activity Log ──

export interface ActivityLog {
  id: string;
  user_id?: string;
  account_id?: string;
  automation_id: string;
  automation_name: string;
  instagram_user_id: string;
  instagram_username: string;
  comment_text: string;
  matched_keyword: string;
  dm_sent: boolean;
  comment_replied: boolean;
  ai_generated: boolean;
  error_message?: string;
  created_at: string;
}

// ── Dashboard Stats ──

export interface DashboardStats {
  total_automations: number;
  active_automations: number;
  total_dms_sent: number;
  total_comments_replied: number;
  dms_today: number;
  dms_this_week: number;
  ai_replies: number;
  accounts_connected: number;
}

// ── Analytics ──

export interface AnalyticsData {
  dms_over_time: Array<{ date: string; count: number; ai_count: number }>;
  top_keywords: Array<{ keyword: string; count: number }>;
  hourly_distribution: Array<{ hour: number; count: number }>;
  success_rate: { sent: number; failed: number };
  per_account: Array<{ account_id: string; username: string; count: number }>;
}

// ── Webhook Payload ──

export interface WebhookCommentPayload {
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      field: string;
      value: {
        from: {
          id: string;
          username: string;
        };
        media: {
          id: string;
          media_product_type: string;
        };
        id: string;
        text: string;
        timestamp: string;
      };
    }>;
  }>;
  object: string;
}
