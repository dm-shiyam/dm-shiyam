import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserByProviderId, createUser } from "./db";

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
        action: { label: "Action", type: "text" }, // "login" or "signup"
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { email, password, name, action } = credentials;

        if (action === "signup") {
          const existing = getUserByEmail(email);
          if (existing) throw new Error("Email already registered");
          if (!name) throw new Error("Name is required");

          const hash = await bcrypt.hash(password, 12);
          const user = createUser({
            email,
            name,
            password_hash: hash,
            provider: "credentials",
          });
          return { id: user.id, email: user.email, name: user.name };
        }

        // Login
        const user = getUserByEmail(email);
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
        const existing = getUserByEmail(user.email!);
        if (existing) return true;

        createUser({
          email: user.email!,
          name: user.name || "User",
          provider: "google",
          provider_id: account.providerAccountId,
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = getUserByEmail(user.email!);
        if (dbUser) {
          token.userId = dbUser.id;
          token.plan = dbUser.plan;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).plan = token.plan;
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
  secret: process.env.NEXTAUTH_SECRET || "dm-shiyam-dev-secret-change-in-production",
};
