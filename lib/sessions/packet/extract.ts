// Post-session extraction: one Claude call turns a SessionRecord into a draft
// SessionPacket, then groundPacket() drops anything unverifiable and deriveLabels()
// computes the factual labels. Mirrors the lenient-parse pattern of analyze.ts.
import Anthropic from "@anthropic-ai/sdk";
import type { SessionRecord } from "../types";
import type { EvidenceInsight, EvidenceRef, InsightType, ProductMoment, SessionPacket } from "./types";
import { groundPacket } from "./ground";
import { deriveLabels } from "./labels";

export type ChatFn = (system: string, user: string) => Promise<string>;
export const PROMPT_VERSION = "packet-v1";

const SYSTEM = `You analyze a finished sales-demo conversation and produce a structured packet for the salesperson.
Return ONLY a JSON object with this exact shape (omit a bucket's items if there is no grounded evidence):
{
  "summary": string,
  "whyTheyCame": Insight[],
  "buyerBackground": Insight[],
  "painPoints": Insight[],
  "buyingSignals": Insight[],
  "objections": Insight[],
  "questions": Insight[],
  "workflowGaps": Insight[],
  "productGaps": Insight[],
  "productMoments": { "label": string, "evidence": Evidence[] }[],
  "recommendedNextAction": { "text": string, "evidence": Evidence[] },
  "followUpEmail": { "subject": string, "body": string }
}
An Insight is { "title": string, "detail": string, "evidence": Evidence[] }.
An Evidence is either {"kind":"quote","role":"user"|"agent","text":<a VERBATIM substring of that speaker's line>} or {"kind":"action","label":<a page URL or clicked label that was actually visited>}.
HARD RULES:
- Every Insight, productMoment, and recommendedNextAction MUST include at least one evidence entry copied EXACTLY from the transcript or a recorded action. If you cannot ground a claim, OMIT it. Never invent quotes.
- Do NOT output labels, scores, conversion probability, or qualification certainty. Those are derived elsewhere from your evidence.
- summary and followUpEmail are prose and need no evidence, but must only reference grounded facts.`;

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

const INSIGHT_TYPES: InsightType[] = [
  "why_here", "buyer_background", "pain_point", "buying_signal",
  "objection", "question", "workflow_gap", "product_gap",
];

// Model evidence lacks turn/ts/chunkId; grounding stamps them. Placeholder values
// here are overwritten by verifyRef() and never reach storage ungrounded.
function coerceRefs(v: unknown): EvidenceRef[] {
  if (!Array.isArray(v)) return [];
  const out: EvidenceRef[] = [];
  for (const e of v as any[]) {
    if (e?.kind === "quote" && typeof e.text === "string") {
      out.push({ kind: "quote", role: e.role === "agent" ? "agent" : "user", text: e.text, turn: 0, transcriptChunkId: "", ts: 0 });
    } else if (e?.kind === "action" && typeof e.label === "string") {
      out.push({ kind: "action", label: e.label, ts: 0 });
    }
  }
  return out;
}

function coerceInsights(v: unknown, fallback: InsightType): EvidenceInsight[] {
  if (!Array.isArray(v)) return [];
  return (v as any[])
    .filter((i) => i && typeof i.title === "string")
    .map((i, idx) => ({
      id: `${fallback}-${idx}`,
      type: INSIGHT_TYPES.includes(i.type) ? i.type : fallback,
      title: String(i.title),
      detail: typeof i.detail === "string" ? i.detail : "",
      evidence: coerceRefs(i.evidence),
    }));
}

function coerceMoments(v: unknown): ProductMoment[] {
  if (!Array.isArray(v)) return [];
  return (v as any[])
    .filter((m) => m && typeof m.label === "string")
    .map((m, idx) => ({ id: `moment-${idx}`, label: String(m.label), evidence: coerceRefs(m.evidence) }));
}

export function parsePacket(
  raw: string,
  sessionId: string,
  now: number,
  modelInfo: SessionPacket["modelInfo"],
): SessionPacket | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  let o: any;
  try {
    o = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  return {
    sessionId,
    generatedAt: now,
    modelInfo,
    summary: typeof o.summary === "string" ? o.summary : "",
    whyTheyCame: coerceInsights(o.whyTheyCame, "why_here"),
    buyerBackground: coerceInsights(o.buyerBackground, "buyer_background"),
    painPoints: coerceInsights(o.painPoints, "pain_point"),
    buyingSignals: coerceInsights(o.buyingSignals, "buying_signal"),
    objections: coerceInsights(o.objections, "objection"),
    questions: coerceInsights(o.questions, "question"),
    workflowGaps: coerceInsights(o.workflowGaps, "workflow_gap"),
    productGaps: coerceInsights(o.productGaps, "product_gap"),
    productMoments: coerceMoments(o.productMoments),
    recommendedNextAction: o.recommendedNextAction?.text
      ? { text: String(o.recommendedNextAction.text), evidence: coerceRefs(o.recommendedNextAction.evidence) }
      : undefined,
    followUpEmail: o.followUpEmail
      ? { subject: String(o.followUpEmail.subject ?? ""), body: String(o.followUpEmail.body ?? "") }
      : undefined,
    labels: [],
  };
}

const MODEL = () => process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
let client: Anthropic | null = null;

const defaultChat: ChatFn = async (system, user) => {
  client ??= new Anthropic();
  const res = await client.messages.create({
    model: MODEL(),
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
};

export async function extractPacket(
  record: SessionRecord,
  chat: ChatFn = defaultChat,
  now: number = Date.now(),
): Promise<SessionPacket> {
  const modelInfo = { provider: "anthropic", model: MODEL(), promptVersion: PROMPT_VERSION };
  const raw = await chat(SYSTEM, buildUserPrompt(record));
  const parsed = parsePacket(raw, record.id, now, modelInfo);
  if (!parsed) throw new Error("packet parse failed");
  const grounded = groundPacket(parsed, record);
  return { ...grounded, labels: deriveLabels(grounded, record) };
}
