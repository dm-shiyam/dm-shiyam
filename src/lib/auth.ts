import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserByProviderId, getUserById, createUser, touchUserLogin } from "./db";
import { rateLimit } from "./rate-limiter";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        action: { label: "Action", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { email, password, name, action } = credentials;

        if (action === "signup") {
          const existing = await getUserByEmail(email);
          if (existing) throw new Error("Email already registered");
          if (!name) throw new Error("Name is required");

          // Password policy: min 8 chars, must contain letters and digits
          if (password.length < 8) throw new Error("Password must be at least 8 characters");
          if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
            throw new Error("Password must contain letters and numbers");
          }

          const hash = await bcrypt.hash(password, 12);
          try {
            const user = await createUser({
              email,
              name,
              password_hash: hash,
              provider: "credentials",
            });
            return { id: user.id, email: user.email, name: user.name };
          } catch (err) {
            // Postgres unique_violation code — race condition: another concurrent
            // signup created the same email between our check and insert. Return
            // the friendly duplicate-email error instead of a raw DB crash.
            if ((err as { code?: string })?.code === "23505") {
              throw new Error("Email already registered");
            }
            throw err;
          }
        }

        // Login — rate limit by email to prevent brute force (10 tries / 15 min)
        const rl = rateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
        if (!rl.allowed) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await getUserByEmail(email);
        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existing = await getUserByEmail(user.email!);
        if (existing) return true;

        try {
          await createUser({
            email: user.email!,
            name: user.name || "User",
            provider: "google",
            provider_id: account.providerAccountId,
          });
        } catch (err) {
          // unique_violation: another concurrent sign-in created the user first.
          // Treat as success — the user exists now, which is what we wanted.
          if ((err as { code?: string })?.code !== "23505") throw err;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: populate token from DB
        const dbUser = await getUserByEmail(user.email!);
        if (dbUser) {
          token.userId = dbUser.id;
          token.plan = dbUser.plan;
          token.role = dbUser.role || "user";
          token.hasSeenOnboarding = dbUser.has_seen_onboarding ?? false;
          // Track last login (fire-and-forget so slow DB doesn't block auth)
          touchUserLogin(dbUser.id).catch((err) =>
            console.error("[auth] touchUserLogin failed:", err)
          );
        }
      } else if (token.userId) {
        // Subsequent requests: re-validate user still exists & sync latest data
        const dbUser = await getUserById(token.userId as string);
        if (!dbUser) {
          return { ...token, userId: null, expired: true };
        }
        token.plan = dbUser.plan;
        token.role = dbUser.role || "user";
      }
      return token;
    },

    async session({ session, token }) {
      if (!token.userId || token.expired) {
        return { ...session, user: undefined } as typeof session;
      }
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).plan = token.plan;
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).has_seen_onboarding = token.hasSeenOnboarding;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Explicit cookie hardening (defaults are similar but making it explicit
  // prevents accidental misconfig; SameSite=Lax is the primary CSRF defense
  // for our authenticated API routes since cross-origin POST won't send the cookie)
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: (() => {
    const s = process.env.NEXTAUTH_SECRET;
    if (!s) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("NEXTAUTH_SECRET is required in production");
      }
      console.warn("[auth] NEXTAUTH_SECRET not set — using dev-only fallback. DO NOT ship without setting it.");
      return "dm-shiyam-dev-only-do-not-use-in-prod";
    }
    return s;
  })(),
};