"use client";

// NextAuth/Google sign-in is deferred to a later phase.
// This wrapper is a passthrough until then.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
