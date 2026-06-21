// The integrity gate. Adapted from lib/sessions/ground.ts: a quote must appear
// (case/space-normalized) in a transcript turn; an action must match a recorded
// page_visited url or agent_action detail. Verified quotes are stamped with the
// transcript turn as the stable chunk id. Anything unverifiable is dropped.
import type { SessionRecord } from "../types";
import type { EvidenceInsight, EvidenceRef, ProductMoment, SessionPacket } from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function verifyRef(ev: EvidenceRef, record: SessionRecord): EvidenceRef | null {
  if (ev.kind === "quote") {
    const want = normalize(ev.text);
    if (!want) return null;
    const bySpeaker = record.transcript.find(
      (t) => t.role === ev.role && normalize(t.text).includes(want),
    );
    const turn = bySpeaker ?? record.transcript.find((t) => normalize(t.text).includes(want));
    if (!turn) return null;
    return { kind: "quote", role: turn.role, text: ev.text.trim(), turn: turn.turn, transcriptChunkId: String(turn.turn), ts: turn.ts };
  }
  const want = normalize(ev.label);
  if (!want) return null;
  const hit = record.events.find(
    (e) =>
      (e.kind === "page_visited" && normalize(e.url).includes(want)) ||
      (e.kind === "agent_action" && normalize(e.detail).includes(want)),
  );
  if (!hit) return null;
  return { kind: "action", label: ev.label.trim(), ts: hit.ts };
}

export function groundEvidence(list: EvidenceRef[], record: SessionRecord): EvidenceRef[] {
  return (list ?? [])
    .map((e) => verifyRef(e, record))
    .filter((e): e is EvidenceRef => e !== null);
}

export function groundInsights(list: EvidenceInsight[], record: SessionRecord): EvidenceInsight[] {
  return (list ?? [])
    .map((i) => ({ ...i, evidence: groundEvidence(i.evidence, record) }))
    .filter((i) => i.evidence.length > 0);
}

function groundMoments(list: ProductMoment[], record: SessionRecord): ProductMoment[] {
  return (list ?? [])
    .map((m) => ({ ...m, evidence: groundEvidence(m.evidence, record) }))
    .filter((m) => m.evidence.length > 0);
}

export function groundPacket(packet: SessionPacket, record: SessionRecord): SessionPacket {
  const nextEv = groundEvidence(packet.recommendedNextAction?.evidence ?? [], record);
  return {
    ...packet,
    whyTheyCame: groundInsights(packet.whyTheyCame, record),
    buyerBackground: groundInsights(packet.buyerBackground, record),
    painPoints: groundInsights(packet.painPoints, record),
    buyingSignals: groundInsights(packet.buyingSignals, record),
    objections: groundInsights(packet.objections, record),
    questions: groundInsights(packet.questions, record),
    workflowGaps: groundInsights(packet.workflowGaps, record),
    productGaps: groundInsights(packet.productGaps, record),
    productMoments: groundMoments(packet.productMoments, record),
    recommendedNextAction: nextEv.length
      ? { text: packet.recommendedNextAction?.text ?? "", evidence: nextEv }
      : undefined,
  };
}
