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
