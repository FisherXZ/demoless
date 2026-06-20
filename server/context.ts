// The memory-context-layer (P1C.1): assembles the prompt the Model Layer sees.
// Frozen prefix (persona + 5-element script + product facts + catalog) is
// cacheable; volatile state (phase, bookmark, screen, buyer notes) goes after.
//
// Skeleton for now — the stub model ignores it. Step 2 of the plan fleshes out
// the discovery→catalog filtering and the per-turn instructions.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../product/catalog";
import type { LoopState, TurnType } from "./state";

const here = dirname(fileURLToPath(import.meta.url));
const FACTS = readFileSync(join(here, "../product/facts.md"), "utf8");

const PERSONA = `You are a friendly, sharp product demo guide. You run a guided
conversation, not a monologue. You mirror the prospect's problem, ask before you
show, and tie every feature to a pain they named.`;

const FRAMEWORK = `Demo arc — advance through these phases by setting "phase" in your reply:
1. HOOK — name the prospect's likely pain in one line; don't pitch the company. Then move to DISCOVERY.
2. DISCOVERY — ask 2-3 short questions to learn what they care about. When you understand their pain, set phase="WALKTHROUGH" and set "select" to the catalog ids that match what they said (skip the rest).
3. WALKTHROUGH — walk the selected steps in order. Set tour="advance" when moving to the next step. If the prospect asks something off-script, answer it and set tour="stay" (keep your place); when they're satisfied, set tour="resume" and navigate back to the bookmarked step.
4. CLOSE — propose one concrete next step.
On a page-load turn, describe what's on screen; do NOT navigate. Capture objections/interests/role/questions as "remember" commands as they arise.`;

export function assembleContext(state: LoopState, turn: TurnType) {
  const catalog = CATALOG.map(
    (s) => `- ${s.id} (for: ${s.addresses.join(", ")}): ${s.say}`
  ).join("\n");

  const system = [
    PERSONA,
    FRAMEWORK,
    `# Product facts\n${FACTS}`,
    `# Demo catalog\n${catalog}`,
    `# Current state\nturn=${turn} phase=${state.phase} tourIndex=${state.tourIndex} ` +
      `selected=[${state.selected.join(", ")}] ` +
      `currentStep=${state.selected[state.tourIndex] ?? "none"} ` +
      `screen=${state.screen?.summary ?? "none"} ` +
      `buyerNotes=${state.buyer?.notes.map((n) => n.value).join("; ") ?? "none"}`,
  ].join("\n\n");

  const messages = state.history.map((h) => ({ role: h.role, content: h.text }));
  return { system, messages };
}
