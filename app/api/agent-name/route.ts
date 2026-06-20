import { NextResponse } from "next/server";
import { DEFAULT_LANGUAGE } from "@/lib/voice/messages";
import { createTts } from "@/server/tts";

// Read env at request time so changing the voice model is reflected without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Exposes the agent's display name to the (client-side) pre-call screens, which
 * can't see the server-only voice-model env. Uses the same resolution as a live
 * voice session: AGENT_NAME override, else the name derived from the voice model.
 */
export function GET() {
  const override = process.env.AGENT_NAME?.trim();
  const agentName = override || createTts().voiceName(DEFAULT_LANGUAGE);
  return NextResponse.json({ agentName });
}
