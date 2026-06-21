"use server";

import { auth } from "@/auth";
import { upsertProfile, loadBuyer } from "@/lib/memory";

/** Manual pre-call form fields (identity comes from the verified session). */
export interface DemoFields {
  role?: string;
  size?: string;
  useCase?: string;
}

export interface EnterDemoResult {
  recallLine?: string;
  isReturning: boolean;
}

/**
 * Called when a signed-in buyer starts a demo. Persists the verified Google
 * account (email + name) plus the manual form fields into the P4 Redis layer
 * and bumps the visit, returning the "welcome back" recall for returning
 * buyers. Identity is read from the server-side session, never from the client,
 * so the buyer key cannot be spoofed. A Redis outage never blocks the demo.
 */
export async function enterDemo(fields: DemoFields): Promise<EnterDemoResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");

  try {
    await upsertProfile(email, {
      name: session.user?.name ?? undefined,
      role: fields.role,
      size: fields.size,
      useCase: fields.useCase,
    });
    const mem = await loadBuyer(email);
    return { recallLine: mem.recall.line, isReturning: mem.isReturning };
  } catch (err) {
    console.error("enterDemo: memory persist failed (continuing):", err);
    return { isReturning: false };
  }
}
