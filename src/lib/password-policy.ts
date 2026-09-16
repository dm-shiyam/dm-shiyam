// src/lib/password-policy.ts
// Single source of truth for password rules — imported by:
//   - LoginForm.tsx  (client-side live checklist + submit gate)
//   - lib/auth.ts    (NextAuth authorize signup path)
//   - api/auth/register/route.ts (legacy signup endpoint)
//
// Keeping the rules here means the UI checklist can NEVER disagree with
// what the server enforces (which was the case before: UI said "Min. 6"
// but server rejected anything under 8, so users saw confusing errors).

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A-Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a-z)",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "digit",
    label: "One number (0-9)",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "special",
    // Common special char set — deliberately broad so users aren't
    // frustrated by "which special chars count?". Matches non-alphanum
    // ASCII punctuation and symbols.
    label: "One special character (!@#$…)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

/**
 * Validate a password against all rules. Returns { valid: true } if all
 * rules pass, else { valid: false, error: "first failing rule's label" }.
 * The error string is user-facing — server sends it verbatim back to the
 * form when a request bypasses the client checklist (e.g. API call with
 * curl, or JS disabled).
 */
export function validatePassword(
  password: string
): { valid: true } | { valid: false; error: string } {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      return { valid: false, error: `Password must include: ${rule.label.toLowerCase()}` };
    }
  }
  return { valid: true };
}
