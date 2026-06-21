// Labels are factual filters DERIVED from grounded survivors — never emitted by
// the model. Each label maps to surviving evidence (spec §5.1).
import type { SessionRecord } from "../types";
import type { EvidenceInsight, EvidenceRef, SessionLabel, SessionPacket } from "./types";

const PRICING = /pric|cost|\$|\bplan\b|quote|budget/i;
const INTEGRATION = /integrat|\bapi\b|webhook|connect|\bsdk\b/i;
const HOT = /how do (i|we)|get started|getting started|sign ?up|free trial|start a trial|this quarter|timeline|urgen|move forward|next steps?/i;

function quoteText(refs: EvidenceRef[]): string {
  return refs.map((r) => (r.kind === "quote" ? r.text : "")).join(" ");
}

function insightText(list: EvidenceInsight[]): string {
  return list.map((i) => `${i.title} ${i.detail} ${quoteText(i.evidence)}`).join(" ");
}

function pageUrlText(record: SessionRecord): string {
  return record.events.map((e) => (e.kind === "page_visited" ? e.url : "")).join(" ");
}

export function deriveLabels(packet: SessionPacket, record: SessionRecord): SessionLabel[] {
  const labels = new Set<SessionLabel>();
  if (packet.painPoints.length) labels.add("strong_pain");
  if (packet.productGaps.length) labels.add("product_gap");
  if (packet.objections.length) labels.add("objection");

  const pages = pageUrlText(record);
  if (PRICING.test(insightText([...packet.questions, ...packet.buyingSignals])) || PRICING.test(pages)) {
    labels.add("asked_pricing");
  }
  if (INTEGRATION.test(insightText(packet.questions)) || INTEGRATION.test(pages)) {
    labels.add("asked_integration");
  }

  const hasNext = !!packet.recommendedNextAction?.evidence?.length;
  if (hasNext || labels.has("asked_pricing")) labels.add("follow_up_needed");
  if (HOT.test(insightText(packet.buyingSignals))) labels.add("hot");
  if (!hasNext && !labels.has("hot") && !labels.has("follow_up_needed")) {
    labels.add("no_clear_next_step");
  }
  return [...labels];
}
