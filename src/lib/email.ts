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
    return { success: false, error: "Email service not configured" };
  }
  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: wrapTemplate(html),
    });
    console.log(`[email] Sent "${subject}" to ${to}`, result);
    return { success: true };
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err);
    return { success: false, error: String(err) };
  }
}

// ═══════════════════════════════════════
//  Email template wrapper
// ═══════════════════════════════════════

function wrapTemplate(body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 520px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 20px; color: #6366f1; margin: 0;">${APP_NAME}</h1>
      </div>
      ${body}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
      <p style="color: #999; font-size: 12px; text-align: center;">
        ${APP_NAME} &middot;
        <a href="${APP_URL}" style="color: #999;">dmshiyam.com</a> &middot;
        <a href="mailto:dmshiyamofficial@gmail.com" style="color: #999;">dmshiyamofficial@gmail.com</a>
      </p>
    </div>
  `;
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

function ctaButton(href: string, label: string, color = "#6366f1"): string {
  return `<a href="${href}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>`;
}

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
