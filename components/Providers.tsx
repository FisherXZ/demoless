"use client";

import { SessionProvider } from "next-auth/react";

/** Client boundary so screens can use useSession() / signIn() / signOut(). */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
