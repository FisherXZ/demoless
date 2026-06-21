// Post-session analysis: one non-streaming Claude call turns a SessionRecord into
// a RecapReport, then groundInsights() verifies every cited quote/action against
// the trace and drops anything unverifiable. Fire-and-forget from session teardown.
import Anthropic from "@anthropic-ai/sdk";
import { groundInsights } from "./ground";
import { saveRecap } from "./store";
import type { Evidence, RecapLabel, RecapReport, SessionRecord } from "./types";

export type ChatFn = (system: string, user: string) => Promise<string>;

const SYSTEM = `You analyze a finished sales-demo conversation and produce a recap for the salesperson.
Return ONLY a JSON object with this exact shape:
{
  "label": "hot" | "follow_up_needed" | "nurture",
  "labelEvidence": Evidence[],
  "summary": string,
  "whyTheyCame": { "text": string, "evidence": Evidence[] },
  "buyingSignals": { "text": string, "evidence": Evidence[] }[],
  "objectionsQuestions": { "text": string, "kind": "objection" | "question", "evidence": Evidence[] }[],
  "gaps": { "text": string, "evidence": Evidence[] }[],
  "nextAction": { "text": string, "evidence": Evidence[] },
  "draftEmail": { "subject": string, "body": string }
}
An Evidence is either {"kind":"quote","speaker":"user"|"agent","text":<a VERBATIM substring of that speaker's line>} or {"kind":"action","label":<a page URL or clicked label that was actually visited>}.
HARD RULES:
- Every item in whyTheyCame, buyingSignals, objectionsQuestions, gaps, and nextAction MUST include at least one evidence entry copied EXACTLY from the transcript or a recorded action. If you cannot ground a claim, OMIT it. Never invent quotes.
- Classify "label": "hot" for explicit purchase intent or asking how/where to buy; "follow_up_needed" for explicit pricing questions, asking for a concrete next step, or asking to involve their team; otherwise "nurture". Back a hot/follow_up_needed label with the exact buyer quote in labelEvidence.
- summary and draftEmail are prose and need no evidence, but must only reference grounded facts.`;

/** Format the trace into a numbered transcript with inline page/action markers. */
function buildUserPrompt(record: SessionRecord): string {
  const lines: string[] = [];
  for (const e of record.events) {
    if (e.kind === "user_said") lines.push(`[turn ${e.turn}][USER] ${e.text}`);
    else if (e.kind === "agent_said") lines.push(`[turn ${e.turn}][AGENT] ${e.text}`);
    else if (e.kind === "page_visited") lines.push(`[turn ${e.turn}][PAGE] ${e.url}`);
    else if (e.kind === "agent_action") lines.push(`[turn ${e.turn}][ACTION ${e.action}] ${e.detail}`);
  }
  return `Company: ${record.company}\nVisitor role: ${record.role ?? "unknown"}\nPhase reached: ${record.phaseReached ?? "unknown"}\n\nTranscript and actions:\n${lines.join("\n")}`;
}

/** Lenient parse: pull the first {...} object out of the model output and coerce. */
export function parseRecap(raw: string, sessionId: string, now: number): RecapReport | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  let obj: any;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const evList = (v: any): Evidence[] => (Array.isArray(v) ? v.filter((e) => e && (e.kind === "quote" || e.kind === "action")) : []);
  const labels: RecapLabel[] = ["hot", "follow_up_needed", "nurture"];
  return {
    sessionId,
    generatedAt: now,
    label: labels.includes(obj.label) ? obj.label : "nurture",
    labelEvidence: evList(obj.labelEvidence),
    summary: typeof obj.summary === "string" ? obj.summary : "",
    whyTheyCame: { text: String(obj.whyTheyCame?.text ?? ""), evidence: evList(obj.whyTheyCame?.evidence) },
    buyingSignals: Array.isArray(obj.buyingSignals)
      ? obj.buyingSignals.filter((s: any) => s?.text).map((s: any) => ({ text: String(s.text), evidence: evList(s.evidence) }))
      : [],
    objectionsQuestions: Array.isArray(obj.objectionsQuestions)
      ? obj.objectionsQuestions.filter((o: any) => o?.text).map((o: any) => ({
          text: String(o.text),
          kind: o.kind === "objection" ? "objection" : "question",
          evidence: evList(o.evidence),
        }))
      : [],
    gaps: Array.isArray(obj.gaps)
      ? obj.gaps.filter((g: any) => g?.text).map((g: any) => ({ text: String(g.text), evidence: evList(g.evidence) }))
      : [],
    nextAction: { text: String(obj.nextAction?.text ?? ""), evidence: evList(obj.nextAction?.evidence) },
    draftEmail: {
      subject: String(obj.draftEmail?.subject ?? ""),
      body: String(obj.draftEmail?.body ?? ""),
    },
  };
}

const defaultChat: ChatFn = async (system, user) => {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  const res = await client.messages.create({
    model,
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
};

/** Analyze a session into a grounded RecapReport. null if nothing to analyze / parse fails. */
export async function analyzeSession(
  record: SessionRecord,
  chat: ChatFn = defaultChat,
  now: number = Date.now()
): Promise<RecapReport | null> {
  if (!record.transcript.some((t) => t.role === "user")) return null;
  const raw = await chat(SYSTEM, buildUserPrompt(record));
  const parsed = parseRecap(raw, record.id, now);
  if (!parsed) return null;
  return groundInsights(parsed, record);
}

/** Fire-and-forget entry from teardown: analyze, then persist. Never throws. */
export async function analyzeAndStore(record: SessionRecord, chat: ChatFn = defaultChat): Promise<void> {
  try {
    const recap = await analyzeSession(record, chat);
    if (!recap) return;
    await saveRecap(record.id, recap);
    console.log(`[sessions] stored recap for ${record.id} (label=${recap.label})`);
  } catch (err) {
    console.error("[sessions] analyzeAndStore failed:", err);
  }
}
