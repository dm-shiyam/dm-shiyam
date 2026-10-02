// lib/email.ts — Email notification service using Resend

import { Resend } from "resend";

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "DM Shiyam";
const APP_URL = process.env.NEXTAUTH_URL || "https://dmshiyam.com";

// Lazy-init Resend so missing API key doesn't crash the whole app at import time
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — emails will be skipped");
    return null;
  }
  _resend = new Resend(key);
  return _resend;
}

// ═══════════════════════════════════════
//  Shared email wrapper
// ═══════════════════════════════════════

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.warn(`[email] skip "${subject}" to ${to} — RESEND_API_KEY missing`);
    return { success: false, error: "Email service not configured" };
  }
  try {
    // Resend SDK returns { data, error } instead of throwing on API-level
    // rejects (e.g. unverified sender domain, invalid API key, rate limit).
    // Was treating every non-throw as success and logging "Sent", which
    // masked real failures (confirmed 2026-10-02 — users clicked Cancel,
    // got a success toast, but no email landed because Resend rejected
    // the unverified FROM_EMAIL and the error was invisible).
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: wrapTemplate(html),
    });
    if (error) {
      console.error(
        `[email] Resend rejected "${subject}" to ${to}:`,
        JSON.stringify(error)
      );
      return { success: false, error: JSON.stringify(error) };
    }
    console.log(`[email] Sent "${subject}" to ${to} id=${data?.id ?? "?"}`);
    return { success: true };
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err);
    return { success: false, error: String(err) };
  }
}

// ═══════════════════════════════════════
//  Email template wrapper
// ═══════════════════════════════════════
//
// Branded shell applied to every outgoing email. Design goals:
//   • Logo is a hosted <img> (Gmail/Outlook refuse CID attachments by default).
//     Served from /public/logo.png (transparent, RGBA) — same origin as the
//     app, so no CDN dep.
//   • Fixed 560px card on a soft neutral canvas — renders predictably in
//     Gmail web / iOS Mail / Outlook, which all cap width differently.
//   • All CSS inlined on each element (email clients strip <style>).
//   • Dark-mode agnostic: light background with high-contrast text so Gmail's
//     auto dark-mode remap doesn't invert into unreadable blobs.

const LOGO_URL = `${APP_URL}/logo.png`;
const BRAND_PRIMARY = "#6366f1";
const SUPPORT_MAILTO = "dmshiyamofficial@gmail.com";

function wrapTemplate(body: string): string {
  return `
    <div style="background:#f6f7fb;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,0.04);">

        <!-- Header -->
        <div style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #f1f5f9;">
          <img src="${LOGO_URL}" alt="${APP_NAME}" width="88" height="88" style="display:inline-block;width:88px;height:88px;border-radius:16px;object-fit:cover;box-shadow:0 2px 8px rgba(99,102,241,0.12);" />
          <div style="margin-top:14px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#111827;">${APP_NAME}</div>
          <div style="margin-top:4px;font-size:12px;color:#6b7280;">Instagram DM automation on autopilot</div>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;font-size:15px;line-height:1.65;color:#1f2937;">
          ${body}
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px 28px;background:#fafbfc;border-top:1px solid #f1f5f9;text-align:center;font-size:12px;line-height:1.6;color:#6b7280;">
          <div style="margin-bottom:6px;">
            <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">dmshiyam.com</a>
            &nbsp;·&nbsp;
            <a href="mailto:${SUPPORT_MAILTO}" style="color:#6b7280;text-decoration:none;">${SUPPORT_MAILTO}</a>
          </div>
          <div style="color:#9ca3af;">You're receiving this because you have an account at ${APP_NAME}.</div>
        </div>

      </div>
    </div>
  `;
}

// Shared primitives used across templates
function ctaButton(href: string, label: string, color = BRAND_PRIMARY): string {
  return `<a href="${href}" style="display:inline-block;margin:20px 0 8px;padding:12px 24px;background:${color};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`;
}

function infoCard(
  rows: Array<{ label: string; value: string }>,
  accent = "#f8fafc"
): string {
  const trs = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">${r.label}</td><td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;font-weight:600;">${r.value}</td></tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;background:${accent};border:1px solid #e5e7eb;border-radius:10px;padding:4px 14px;margin:16px 0;"><tbody>${trs}</tbody></table>`;
}

// Format paise (integer) → ₹X,XXX.XX. Razorpay amounts are always paise.
function formatInr(paise: number): string {
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format Unix seconds → "15 Nov 2026". null-safe.
function formatDate(unixSec: number | null | undefined): string {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  A14: In-app feedback → support inbox
// ═══════════════════════════════════════════════════════════════════════════

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "dmshiyamofficial@gmail.com";

export async function sendFeedbackToSupport({
  rating,
  comment,
  userEmail,
  userName,
  source,
}: {
  rating: "up" | "down";
  comment?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  source: string;
}) {
  const emoji = rating === "up" ? "👍" : "👎";
  const subject = `${emoji} Feedback (${rating}) from ${userName || userEmail || "anon"}`;
  const commentHtml = comment
    ? `<p><strong>Comment:</strong></p><blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#333;white-space:pre-wrap;">${escapeHtml(
        comment
      )}</blockquote>`
    : `<p style="color:#666;">No comment provided.</p>`;

  return sendEmail({
    to: SUPPORT_EMAIL,
    subject,
    html: `
      <h2 style="color:#111;font-size:18px;margin:0 0 12px;">New in-app feedback</h2>
      <table style="font-size:14px;color:#333;line-height:1.6;">
        <tr><td><strong>Rating:</strong></td><td>${emoji} ${rating}</td></tr>
        <tr><td><strong>User:</strong></td><td>${escapeHtml(userName || "(no name)")} &lt;${escapeHtml(userEmail || "anonymous")}&gt;</td></tr>
        <tr><td><strong>Source:</strong></td><td>${escapeHtml(source)}</td></tr>
      </table>
      ${commentHtml}
      <p style="color:#666;font-size:13px;margin-top:20px;">View all feedback in the <a href="${APP_URL}/admin?tab=feedback">admin dashboard</a>.</p>
    `,
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════════════════════
//  A13: Onboarding drip emails
//  Sent by /api/cron/send-onboarding-emails (daily) except welcome (immediate).
//  Idempotency guarded by claimOnboardingEmail() in db.ts.
// ═══════════════════════════════════════════════════════════════════════════

// Email verification (hard-block flow) — sent immediately on credentials signup.
// Google signups skip this entirely since OAuth already proves ownership.
export async function sendVerificationEmail({
  to,
  name,
  token,
}: {
  to: string;
  name: string;
  token: string;
}) {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: `Verify your email to activate ${APP_NAME}`,
    html: `
      <h2 style="color:#111;font-size:20px;margin:0 0 12px;">Verify your email, ${name || "there"}</h2>
      <p>One last step before you can use ${APP_NAME} — confirm this is really your email address.</p>
      ${ctaButton(verifyUrl, "Verify email →")}
      <p style="color:#666;font-size:14px;">This link expires in 24 hours. If you didn't sign up for ${APP_NAME}, you can ignore this email.</p>
    `,
  });
}

// 13.1 Welcome (Day 0) — sent immediately on signup
export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  return sendEmail({
    to,
    subject: `Welcome to ${APP_NAME} 👋 — your free plan is live`,
    html: `
      <h2 style="color:#111;font-size:20px;margin:0 0 12px;">Welcome, ${name || "there"}!</h2>
      <p>Your <strong>free plan is live</strong> — 500 DMs/month, forever, no credit card. Upgrade only when you outgrow it.</p>
      <p>Here's what most creators do in the first 10 minutes:</p>
      <ol style="padding-left:20px;line-height:1.7;">
        <li><strong>Connect Instagram</strong> — 30-second Meta-approved OAuth.</li>
        <li><strong>Create your first automation</strong> — pick a keyword, write a DM.</li>
        <li><strong>Post the Reel</strong> and tell viewers to comment the keyword.</li>
      </ol>
      <p>Followers who comment get an instant DM — while you keep making content.</p>
      ${ctaButton(`${APP_URL}/dashboard`, "Open your dashboard →")}
      <p style="color:#666;font-size:14px;">Reply to this email if you get stuck — we read every message.</p>
    `,
  });
}

// 13.2 Connect IG nudge (Day 1) — sent if no IG account connected
export async function sendConnectIgNudge({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  return sendEmail({
    to,
    subject: `Ready to connect Instagram? (takes 30 seconds)`,
    html: `
      <h2 style="color:#111;font-size:20px;margin:0 0 12px;">One step to activate ${APP_NAME}</h2>
      <p>Hi ${name || "there"},</p>
      <p>Noticed you haven't connected your Instagram account yet. Without it, your automations can't run — and you're leaving comments unanswered every hour you wait.</p>
      <p><strong>What connecting does:</strong></p>
      <ul style="padding-left:20px;line-height:1.7;">
        <li>Uses Meta's official Instagram Business Login (Tech Provider approved).</li>
        <li>Only three permissions: read profile, read/reply comments, send DMs.</li>
        <li>No Facebook Page required. Disconnect anytime.</li>
      </ul>
      ${ctaButton(`${APP_URL}/dashboard`, "Connect Instagram →")}
      <p style="color:#666;font-size:14px;">Prefer a walkthrough? Watch our 60-second setup video on the dashboard.</p>
    `,
  });
}

// 13.3 First automation nudge (Day 3)
export async function sendFirstAutomationNudge({
  to,
  name,
  hasAccount,
}: {
  to: string;
  name: string;
  hasAccount: boolean;
}) {
  return sendEmail({
    to,
    subject: `Your first automation earns while you sleep 🌙`,
    html: `
      <h2 style="color:#111;font-size:20px;margin:0 0 12px;">Time to build automation #1</h2>
      <p>Hi ${name || "there"},</p>
      <p>Your account's set up${hasAccount ? " and Instagram is connected" : ""} — but no automation is live yet. Let's fix that.</p>
      <p><strong>The 3-minute starter automation that always works:</strong></p>
      <ol style="padding-left:20px;line-height:1.7;">
        <li>Pick your best-performing Reel or post.</li>
        <li>Add a caption: <em>"Comment <strong>GUIDE</strong> and I'll DM you the free version."</em></li>
        <li>Create an automation triggered by <code>GUIDE</code> with the resource link in the DM.</li>
      </ol>
      <p>Most creators get 20–100 qualified DMs from a single post using this pattern.</p>
      ${ctaButton(`${APP_URL}/dashboard`, "Create automation →")}
      <p style="color:#666;font-size:14px;">Need copy inspiration? Check our <a href="${APP_URL}/blog/turn-instagram-comments-into-leads">comments-to-leads playbook</a>.</p>
    `,
  });
}

// 13.4 Case study email (Day 7)
export async function sendCaseStudyEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  return sendEmail({
    to,
    subject: `How creators are turning comments into leads with ${APP_NAME}`,
    html: `
      <h2 style="color:#111;font-size:20px;margin:0 0 12px;">A quick real-world example</h2>
      <p>Hi ${name || "there"},</p>
      <p>You've been on ${APP_NAME} for a week — perfect time to see what other creators are pulling off.</p>
      <p><strong>The comment-to-DM playbook (2 Reels, 1 week):</strong></p>
      <ul style="padding-left:20px;line-height:1.7;">
        <li>Reel 1 — CTA: <em>"Comment HOOKS for the swipe file."</em> Result: 312 comments, 287 DMs auto-sent, 118 replied.</li>
        <li>Reel 2 — CTA: <em>"Comment PRICE for the guide."</em> Result: 176 comments, 168 DMs, 74 replied.</li>
      </ul>
      <p>That's <strong>192 warm conversations in 7 days</strong> — 100% automated, 0 grey-hat scrapers, 100% Meta-approved.</p>
      <p>The two levers that made it work:</p>
      <ol style="padding-left:20px;line-height:1.7;">
        <li>A <strong>specific keyword</strong> in the caption (not "info" or "yes").</li>
        <li>A <strong>24h follow-up DM</strong> to non-repliers — doubled reply rate.</li>
      </ol>
      ${ctaButton(`${APP_URL}/dashboard`, "Build your own →")}
      <p style="color:#666;font-size:14px;">Full breakdown on the blog: <a href="${APP_URL}/blog/how-to-automate-instagram-dms">How to automate Instagram DMs</a>.</p>
    `,
  });
}

// 13.5 Upgrade nudge (Day 12) — the free plan never expires (2026-09-11);
// this email is a value pitch for upgrading, not a scarcity/trial-ending
// nudge like it used to be.
export async function sendUpgradeNudge({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  return sendEmail({
    to,
    subject: `Ready to scale past 500 DMs? 🚀`,
    html: `
      <h2 style="color:#111;font-size:20px;margin:0 0 12px;">Your free plan keeps running — but here's what unlocks on paid</h2>
      <p>Hi ${name || "there"},</p>
      <p>You've been on the free plan for a couple of weeks. It stays free forever — no expiry, no card charge. But if the 500 DMs/month cap is getting tight (or you want AI-generated replies), here's what upgrading gets you:</p>
      <p><strong>Starter</strong> (₹149/mo) — 5,000 DMs, 10 automations, analytics dashboard, email support.</p>
      <p><strong>Pro</strong> (₹799/mo) — 25,000 DMs, <strong>AI Smart Replies</strong> (GPT-4o writes personalized DMs from each comment's context), 3 Instagram accounts, priority support.</p>
      <p><strong>Business</strong> (₹2,499/mo) — 100,000 DMs, 10 accounts, CSV export, dedicated support.</p>
      <p>UPI &amp; card via Razorpay. GST-compliant invoices. Cancel anytime, no contracts.</p>
      ${ctaButton(`${APP_URL}/pricing`, "See plans →")}
      <p style="color:#666;font-size:14px;">Not ready or hit a snag? Reply to this email and tell us what's missing — we read every reply and often ship fixes the same week.</p>
    `,
  });
}

// ═══════════════════════════════════════
//  DM Limit Warning (80%)
// ═══════════════════════════════════════

export async function sendDmLimitWarning({
  to,
  name,
  used,
  limit,
}: {
  to: string;
  name: string;
  used: number;
  limit: number;
}): Promise<{ success: boolean; error?: string }> {
  const percentage = Math.round((used / limit) * 100);
  const remaining = limit - used;

  return sendEmail({
    to,
    subject: `⚠️ You've used ${percentage}% of your DM limit`,
    html: `
      <h2 style="color: #111; font-size: 18px;">DM Limit Warning</h2>
      <p>Hi ${name || "there"},</p>
      <p>You've used <strong>${used} of ${limit}</strong> DMs this month (${percentage}%).</p>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px;
                  border-radius: 4px; margin: 16px 0;">
        <strong style="color: #92400e;">Only ${remaining} DMs remaining</strong>
        <p style="color: #92400e; margin: 4px 0 0; font-size: 14px;">
          Once you hit the limit, no more automated DMs will be sent until next month.
        </p>
      </div>
      <p>To keep your automations running, consider upgrading your plan:</p>
      <a href="${APP_URL}/pricing"
         style="display: inline-block; margin: 16px 0; padding: 12px 24px;
                background: #6366f1; color: #fff; border-radius: 6px;
                text-decoration: none; font-weight: 600;">
        Upgrade Plan
      </a>
      <p style="color: #666; font-size: 14px;">Your DM counter resets on the 1st of each month.</p>
    `,
  });
}

// ═══════════════════════════════════════
//  DM Limit Reached (100%)
// ═══════════════════════════════════════

export async function sendDmLimitReached({
  to,
  name,
  limit,
}: {
  to: string;
  name: string;
  limit: number;
}): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `🚫 DM limit reached — automations paused`,
    html: `
      <h2 style="color: #111; font-size: 18px;">DM Limit Reached</h2>
      <p>Hi ${name || "there"},</p>
      <p>You've used all <strong>${limit}</strong> of your DMs for this month.</p>
      <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px;
                  border-radius: 4px; margin: 16px 0;">
        <strong style="color: #991b1b;">Automations paused</strong>
        <p style="color: #991b1b; margin: 4px 0 0; font-size: 14px;">
          No automated DMs will be sent until your limit resets on the 1st of next month.
        </p>
      </div>
      <p>Upgrade your plan to continue sending DMs immediately:</p>
      <a href="${APP_URL}/pricing"
         style="display: inline-block; margin: 16px 0; padding: 12px 24px;
                background: #6366f1; color: #fff; border-radius: 6px;
                text-decoration: none; font-weight: 600;">
        Upgrade Now
      </a>
    `,
  });
}

// ═══════════════════════════════════════
//  Token Expiring Soon
// ═══════════════════════════════════════

export async function sendTokenExpiryWarning({
  to,
  name,
  igUsername,
  expiresAt,
  daysLeft,
}: {
  to: string;
  name: string;
  igUsername: string;
  expiresAt: string;
  daysLeft: number;
}): Promise<{ success: boolean; error?: string }> {
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return sendEmail({
    to,
    subject: `🔑 Instagram token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `
      <h2 style="color: #111; font-size: 18px;">Token Expiring Soon</h2>
      <p>Hi ${name || "there"},</p>
      <p>The Instagram access token for <strong>@${igUsername}</strong> will expire on
         <strong>${expiryDate}</strong> (${daysLeft} day${daysLeft === 1 ? "" : "s"} from now).</p>
      <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px;
                  border-radius: 4px; margin: 16px 0;">
        <strong style="color: #9a3412;">Action needed</strong>
        <p style="color: #9a3412; margin: 4px 0 0; font-size: 14px;">
          If the token expires, your automations will stop working. Please reconnect your Instagram account.
        </p>
      </div>
      <a href="${APP_URL}/dashboard"
         style="display: inline-block; margin: 16px 0; padding: 12px 24px;
                background: #6366f1; color: #fff; border-radius: 6px;
                text-decoration: none; font-weight: 600;">
        Reconnect Instagram
      </a>
      <p style="color: #666; font-size: 14px;">We'll try to auto-refresh your token, but if that fails you may need to reconnect manually.</p>
    `,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  S5.8.4 — Payment lifecycle emails
//  Triggered from the Razorpay webhook (billing/webhook) and the self-serve
//  cancel API (billing/cancel). Idempotency is enforced upstream by the
//  billing_events table — if an email helper is called more than once it's
//  because the handler was called more than once, which can't happen on a
//  deduped webhook delivery.
// ═══════════════════════════════════════════════════════════════════════════

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  agency: "Agency",
};

function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

function cycleLabel(cycle: "monthly" | "yearly"): string {
  return cycle === "yearly" ? "Yearly" : "Monthly";
}

// 1 — Subscription activated. First successful payment on a new subscription.
//     Doubles as the receipt for the activation charge, so we don't also
//     send sendPaymentReceived for the same transaction.
export async function sendSubscriptionActivated({
  to,
  name,
  plan,
  cycle,
  amountPaise,
  nextChargeAtUnix,
}: {
  to: string;
  name: string;
  plan: string;
  cycle: "monthly" | "yearly";
  amountPaise: number;
  nextChargeAtUnix?: number | null;
}) {
  const planTxt = planLabel(plan);
  return sendEmail({
    to,
    subject: `Welcome to ${APP_NAME} ${planTxt} — your subscription is active`,
    html: `
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">You're on ${planTxt} 🎉</h2>
      <p style="margin:0 0 8px;">Hi ${name || "there"},</p>
      <p style="margin:0 0 12px;">Thanks for subscribing — your <strong>${planTxt} (${cycleLabel(cycle)})</strong> plan is now active and your new DM limit has been applied to your account.</p>
      ${infoCard([
        { label: "Plan", value: `${planTxt} (${cycleLabel(cycle)})` },
        { label: "Amount paid", value: formatInr(amountPaise) },
        { label: "Next billing date", value: formatDate(nextChargeAtUnix) },
      ])}
      ${ctaButton(`${APP_URL}/dashboard`, "Open dashboard →")}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">You can cancel anytime from your dashboard — your plan will stay active until the end of the billing cycle. Need a GST invoice? Reply to this email.</p>
    `,
  });
}

// 2 — Payment received. Recurring charge (not the activation charge; that's
//     covered by sendSubscriptionActivated). Called from the webhook on
//     subscription.charged when the user was already active.
export async function sendPaymentReceived({
  to,
  name,
  plan,
  cycle,
  amountPaise,
  paymentId,
  nextChargeAtUnix,
}: {
  to: string;
  name: string;
  plan: string;
  cycle: "monthly" | "yearly";
  amountPaise: number;
  paymentId: string;
  nextChargeAtUnix?: number | null;
}) {
  const planTxt = planLabel(plan);
  return sendEmail({
    to,
    subject: `Payment received for ${APP_NAME} ${planTxt} — ${formatInr(amountPaise)}`,
    html: `
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">Payment received</h2>
      <p style="margin:0 0 8px;">Hi ${name || "there"},</p>
      <p style="margin:0 0 12px;">We've received your ${cycleLabel(cycle).toLowerCase()} payment for ${APP_NAME} ${planTxt}. Your subscription is renewed and your account is good to go.</p>
      ${infoCard([
        { label: "Plan", value: `${planTxt} (${cycleLabel(cycle)})` },
        { label: "Amount", value: formatInr(amountPaise) },
        { label: "Payment ID", value: paymentId },
        { label: "Next billing date", value: formatDate(nextChargeAtUnix) },
      ])}
      ${ctaButton(`${APP_URL}/dashboard`, "Open dashboard →")}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">This email is your receipt — keep it for your records. Need a GST invoice? Reply to this email.</p>
    `,
  });
}

// 3 — Payment failed. Card declined / insufficient funds / UPI mandate
//     revoked etc. The user is still on their paid plan at this point —
//     Razorpay will retry per its own schedule. We only inform.
export async function sendPaymentFailed({
  to,
  name,
  plan,
  errorReason,
}: {
  to: string;
  name: string;
  plan: string;
  errorReason: string;
}) {
  const planTxt = planLabel(plan);
  return sendEmail({
    to,
    subject: `We couldn't process your ${APP_NAME} payment`,
    html: `
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">Payment couldn't be processed</h2>
      <p style="margin:0 0 8px;">Hi ${name || "there"},</p>
      <p style="margin:0 0 12px;">We tried to charge your payment method for ${APP_NAME} <strong>${planTxt}</strong> but it didn't go through.</p>
      ${infoCard(
        [
          { label: "Plan", value: planTxt },
          { label: "Reason", value: errorReason || "Not specified" },
        ],
        "#fff7ed"
      )}
      <p style="margin:0 0 8px;">What happens next:</p>
      <ul style="margin:0 0 12px;padding-left:20px;line-height:1.7;color:#1f2937;">
        <li>Your subscription stays active — Razorpay will automatically retry over the next few days.</li>
        <li>If retries fail, your plan will downgrade to Free and your automations will pause.</li>
      </ul>
      <p style="margin:0 0 12px;">The quickest fix is to check with your bank, make sure the card/UPI mandate is still valid, or re-subscribe with a new method.</p>
      ${ctaButton(`${APP_URL}/pricing`, "Update payment method →")}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Need help? Reply to this email and we'll sort it out.</p>
    `,
  });
}

// 4a — Cancellation scheduled. Fired from the self-serve cancel API the
//      moment the user confirms the action, before Razorpay actually ends
//      the cycle. "You keep access until <date>".
export async function sendSubscriptionCancellationScheduled({
  to,
  name,
  plan,
  cycleEndUnix,
}: {
  to: string;
  name: string;
  plan: string;
  cycleEndUnix?: number | null;
}) {
  const planTxt = planLabel(plan);
  // Fall back to a human phrase when Razorpay didn't return a cycle end
  // (fallback cancel paths — stale sub id, comp'd accounts, mock subs).
  // Showing an em-dash looks like a bug in the email; the sentence works.
  const accessUntil = cycleEndUnix
    ? formatDate(cycleEndUnix)
    : "End of your current billing cycle";
  return sendEmail({
    to,
    subject: `Your ${APP_NAME} subscription is scheduled to cancel`,
    html: `
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">Cancellation scheduled</h2>
      <p style="margin:0 0 8px;">Hi ${name || "there"},</p>
      <p style="margin:0 0 12px;">Your ${APP_NAME} <strong>${planTxt}</strong> subscription has been scheduled to cancel. You won't be charged again.</p>
      ${infoCard([
        { label: "Plan", value: planTxt },
        { label: "Access until", value: accessUntil },
        { label: "What happens next", value: "Auto-downgrade to Free" },
      ])}
      <p style="margin:0 0 12px;">You'll keep full access to ${APP_NAME} ${planTxt} until the end of your current billing cycle. After that your account automatically moves to the Free plan (500 DMs/month) — your data, automations, and connected accounts stay put.</p>
      <p style="margin:0 0 12px;">Changed your mind? You can resubscribe anytime from the pricing page.</p>
      ${ctaButton(`${APP_URL}/pricing`, "See plans →")}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Mind sharing why you cancelled? Just reply — we read every message and often ship fixes within the week.</p>
    `,
  });
}

// 4b — Subscription ended. Fired from the webhook when Razorpay sends
//      subscription.cancelled / subscription.completed, i.e. the paid
//      cycle actually finished and we've downgraded the user to Free.
export async function sendSubscriptionEnded({
  to,
  name,
  previousPlan,
}: {
  to: string;
  name: string;
  previousPlan: string;
}) {
  const planTxt = planLabel(previousPlan);
  return sendEmail({
    to,
    subject: `Your ${APP_NAME} subscription has ended`,
    html: `
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">Your subscription has ended</h2>
      <p style="margin:0 0 8px;">Hi ${name || "there"},</p>
      <p style="margin:0 0 12px;">Your ${APP_NAME} <strong>${planTxt}</strong> plan has ended as scheduled, and your account is now on the Free plan.</p>
      ${infoCard([
        { label: "Previous plan", value: planTxt },
        { label: "Current plan", value: "Free (500 DMs/month)" },
      ])}
      <p style="margin:0 0 12px;">All your automations, Instagram connections, and settings are preserved — only your monthly DM limit has changed. You can resubscribe anytime to restore your old limits.</p>
      ${ctaButton(`${APP_URL}/pricing`, "See plans →")}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Thanks for being part of ${APP_NAME}. If there's anything we could've done better, just reply to this email.</p>
    `,
  });
}

// 5 — Refund initiated. Fired on refund.created from the Razorpay webhook.
//     Refund typically settles in 5–7 business days depending on the source
//     payment method (UPI usually 2–3, cards 5–7, netbanking varies).
export async function sendRefundInitiated({
  to,
  name,
  amountPaise,
  paymentId,
  refundId,
}: {
  to: string;
  name: string;
  amountPaise: number;
  paymentId: string;
  refundId: string;
}) {
  return sendEmail({
    to,
    subject: `Refund initiated — ${formatInr(amountPaise)} is on its way back`,
    html: `
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">Refund initiated</h2>
      <p style="margin:0 0 8px;">Hi ${name || "there"},</p>
      <p style="margin:0 0 12px;">Your refund of <strong>${formatInr(amountPaise)}</strong> has been initiated for your ${APP_NAME} payment. It'll land back in the account you paid from.</p>
      ${infoCard([
        { label: "Refund amount", value: formatInr(amountPaise) },
        { label: "Payment ID", value: paymentId },
        { label: "Refund ID", value: refundId },
        { label: "Expected timeline", value: "5–7 business days" },
      ])}
      <p style="margin:0 0 12px;">The exact time depends on your bank or UPI app — UPI refunds usually arrive in 2–3 business days, cards and net-banking can take up to 7. If you don't see it after that, forward this email to <a href="mailto:${SUPPORT_MAILTO}" style="color:${BRAND_PRIMARY};">${SUPPORT_MAILTO}</a> and we'll trace it with Razorpay.</p>
      ${ctaButton(`${APP_URL}/dashboard`, "Open dashboard →")}
    `,
  });
}
