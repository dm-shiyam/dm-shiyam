// lib/html.ts — Tiny HTML escaping utility for safely interpolating user data into email templates

/**
 * Escape a string so it can be safely embedded inside HTML text nodes or attribute values.
 * Prevents XSS when interpolating user-controlled data (e.g. names) into email/webpage HTML.
 */
export function escapeHtml(unsafe: string | undefined | null): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
