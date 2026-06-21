"use server";

import { upsertProfile, loadBuyer } from "@/lib/memory";

/** Manual pre-call form fields plus identity from the form. */
export interface DemoFields {
  email: string;
  name?: string;
  role?: string;
  size?: string;
  useCase?: string;
}

export interface EnterDemoResult {
  recallLine?: string;
  isReturning: boolean;
}

/**
 * Called when a buyer starts a demo. Persists the form identity plus manual
 * fields into the P4 Redis layer and bumps the visit, returning the
 * "welcome back" recall for returning buyers.
 * Identity comes from the form (email). A Redis outage never blocks the demo.
 * NOTE: NextAuth/Google sign-in is deferred to a later phase.
 */
export async function enterDemo(fields: DemoFields): Promise<EnterDemoResult> {
  const { email } = fields;
  if (!email) return { isReturning: false };

  try {
    await upsertProfile(email, {
      name: fields.name,
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
