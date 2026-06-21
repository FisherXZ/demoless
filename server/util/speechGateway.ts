/**
 * Speech gateway: a deterministic backstop that keeps the agent's stage
 * directions and filler OUT of the spoken stream. Runs per complete sentence at
 * the say->TTS seam (server/session.ts), so internal "I'll click into this"
 * narration never reaches the voice even when the system prompt fails to
 * suppress it.
 *
 * Design bias: when unsure, SPEAK it. Eating a real value line ("you're losing
 * an afternoon a week to this") is far worse in a sales demo than leaking the
 * occasional "let me". So the drop rules are narrow and require a planning
 * lead-in; anything that carries a value clause is always kept.
 *
 *   sentence ──► [strip lead discourse markers] ──► empty?  ─► DROP
 *                          │
 *                          ├─ bare interjection ("here we go")     ─► DROP
 *                          ├─ "let me <mechanic>" w/o value clause ─► DROP
 *                          └─ otherwise                            ─► SPEAK
 */

// Leading discourse markers that carry no information ("Okay, so ...", "Now,
// ..."). Stripped from the FRONT only, repeatably. Each must be followed by a
// separator so we never bite into a word ("So" but not "Sorry").
const LEAD_FILLER = /^(?:okay|ok|alright|all right|so|now|well|right|yeah|yep|uh|um|and then|and)\b[\s,]*/i;

// A planning lead-in. REQUIRED for a stage-direction drop — its presence is what
// separates filler ("let me look at this") from value ("look how fast this is").
const PLANNING_LEAD =
  "(?:let me|let'?s|lets|i'?ll|i will|i'?m going to|i am going to|let me go ahead and|let me just|i'?ll just)";

// Demo mechanics the visitor can already see happen on screen. Deliberately
// excludes "show" and "see" — "let me show you what this saves" is value, and
// "let me see" is handled as an interjection below.
const MECHANIC =
  "(?:click|tap|navigate|head|go|jump|pull|bring|open|load|scroll|type|enter|search|take a look|look)";

const STAGE_DIRECTION = new RegExp(
  `^${PLANNING_LEAD}\\s+(?:just\\s+)?${MECHANIC}\\b`,
  "i"
);

// Whole-sentence interjections / waiting filler with no payoff.
const INTERJECTION =
  /^(?:okay|ok|alright|all right|right|sure|cool|awesome|perfect|great|got it|here we go|there we go|let'?s see|let me see|one sec(?:ond)?|just a sec(?:ond)?|give me a (?:sec(?:ond)?|moment)|hang on|hold on|bear with me|and there it is)$/i;

// Markers of a real value clause. If a stage-direction sentence also contains
// one of these, it is carrying substance ("let me pull up sessions, because
// this is where your runs live") and must be spoken.
const VALUE_CLAUSE =
  /[,—:;]|\s-\s|\b(?:because|so|that'?s|this is|here'?s|here is|which|where|when|you can|you get)\b/i;

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Returns the speakable text for a sentence, or "" if the sentence is pure
 * stage direction / filler and should not be spoken at all.
 */
export function speechGateway(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // 1. Strip leading discourse markers (repeatably): "Okay, so this ..." -> "this ..."
  let s = trimmed;
  for (let prev = ""; s !== prev; ) {
    prev = s;
    s = s.replace(LEAD_FILLER, "").trim();
  }
  if (!s) return "";

  // Sentence minus trailing punctuation, for whole-sentence matching.
  const core = s.replace(/[.!?,…\s]+$/, "").trim();
  if (!core) return "";

  // 2. Bare interjection -> drop.
  if (INTERJECTION.test(core)) return "";

  // 3. "let me <mechanic> ..." with no value clause -> drop.
  if (STAGE_DIRECTION.test(s) && !VALUE_CLAUSE.test(s)) return "";

  // 4. Recapitalize only if we actually stripped a lead-in.
  return s === trimmed ? s : capitalizeFirst(s);
}
