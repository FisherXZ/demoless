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
1. HOOK — greet with one natural discovery question before navigating or selecting a walkthrough. Do not pitch the company.
2. DISCOVERY — learn why the buyer is here, what workflow or problem they care about, and what background they bring. Ask one short question at a time; do not dump multiple discovery questions in a row. When you understand their pain, set phase="WALKTHROUGH" and set "select" to the catalog ids that match what they said (skip the rest).
3. WALKTHROUGH — walk the selected steps in order. Set tour="advance" when moving to the next step. If the prospect asks something off-script, answer it and set tour="stay" (keep your place); when they're satisfied, set tour="resume" and navigate back to the bookmarked step.
4. CLOSE — propose one concrete next step.
Discovery-first rules:
- Learn why the buyer is here, what workflow or problem they care about, and what background they bring before giving a generic walkthrough.
- Ask one short question at a time; do not dump multiple discovery questions in a row.
- If the buyer directly asks to see a concrete area, honor that request, then ask one short contextual follow-up.
- Capture durable buyer signals as remember commands: persona/background, pain_point/workflow pain, interest, objection, preference, next_step.
- Do not assign lead scores, intent scores, certainty labels, or fake qualification.
On a page-load turn, describe what's on screen; do NOT navigate. Capture persona/background, pain_point, interest, objection, preference, next_step, and question signals as "remember" commands as they arise.`;

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
  // The Messages API needs the conversation to END with a user turn: an empty
  // array 400s ("at least one message"), and a trailing assistant message reads
  // as a prefill and 400s on Opus 4.8. Non-human turns (greet, screen) carry no
  // user input, so inject a synthetic user "event" describing what just happened.
  if (turn === "greet") {
    messages.push({
      role: "user",
      content:
        "[The visitor just opened the demo and hasn't spoken yet. Greet them with one natural discovery question before navigating. If they are a returning buyer with notes, briefly reference a prior factual memory, then ask what they are trying to figure out today.]",
    });
  } else if (turn === "screen") {
    messages.push({
      role: "user",
      content: `[The product screen just changed — now showing: ${state.screen?.summary ?? "a new page"}${state.screen?.url ? ` (${state.screen.url})` : ""}. In one or two sentences, describe what's on screen and tie it to what the prospect cares about. Do NOT navigate.]`,
    });
  } else if (messages.length === 0 || messages[messages.length - 1].role === "assistant") {
    // safety net: never send an empty array or end on an assistant (prefill) turn
    messages.push({ role: "user", content: "[Continue.]" });
  }
  return { system, messages };
}
