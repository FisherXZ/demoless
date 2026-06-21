"use server";

import { upsertProfile, loadBuyer } from "@/lib/memory";
import { createSession } from "@/lib/sessions";

/** Identity captured by the pre-call form. Audience persona is no longer
 *  pre-collected — the agent learns it through discovery. */
export interface DemoFields {
  email: string;
  name?: string;
}

export interface EnterDemoResult {
  demoSessionId?: string;
  recallLine?: string;
  isReturning: boolean;
}

/**
 * Called when a buyer starts a demo. Persists the form identity into the P4
 * buyer-memory layer, creates a demo session up-front (so it exists before the
 * cloud browser does and the voice wire can carry its id), and returns the
 * "welcome back" recall for returning buyers. A Redis outage never blocks the
 * demo. NOTE: NextAuth/Google sign-in is deferred to a later phase.
 */
export async function enterDemo(fields: DemoFields): Promise<EnterDemoResult> {
  const { email } = fields;
  if (!email) return { isReturning: false };

  try {
    await upsertProfile(email, { name: fields.name });
    const session = await createSession({ buyerEmail: email, buyerName: fields.name });
    const mem = await loadBuyer(email);
    return {
      demoSessionId: session.id,
      recallLine: mem.recall.line,
      isReturning: mem.isReturning,
    };
  } catch (err) {
    console.error("enterDemo: memory/session persist failed (continuing):", err);
    return { isReturning: false };
  }
}
