import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) — Google sign-in for buyers.
 *
 * Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET from the environment
 * (Auth.js picks up AUTH_* automatically). JWT session, no DB adapter — the
 * verified email/name are persisted into the P4 Redis layer on demo entry
 * (see lib/actions.ts).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
});
