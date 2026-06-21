// Pure builders: turn a finished session's SessionPacket into the outbound
// actions each connector would perform. No I/O — deterministic given (record,
// packet), so they're trivial to unit-test. Persistence stamps id/ts later.
import type { SessionRecord } from "../sessions/types";
import type { EvidenceInsight, EvidenceRef, SessionPacket } from "../sessions/packet/types";
import type { ConnectorId, DraftAction } from "./types";

/** Stable small number from a string — for mock external refs (no randomness). */
function hashNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function truncate(s: string, max = 80): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Verbatim buyer/agent quotes from an insight's grounded evidence. */
function quotes(refs: EvidenceRef[]): string[] {
  return refs.filter((r): r is Extract<EvidenceRef, { kind: "quote" }> => r.kind === "quote").map((r) => r.text);
}

function buyerName(record: SessionRecord): string {
  return record.buyerName || record.buyerEmail || "Visitor";
}

/** Map the packet's factual labels onto a CRM deal stage. */
function dealStage(packet: SessionPacket): string {
  const has = (l: string) => packet.labels.includes(l as SessionPacket["labels"][number]);
  if (has("hot")) return "Hot — Demo Qualified";
  if (has("follow_up_needed") || has("asked_pricing")) return "Follow-up";
  return "Nurture";
}

/** HubSpot: upsert the contact + move the deal + log the recap and draft email. */
export function buildHubspotActions(record: SessionRecord, packet: SessionPacket): DraftAction[] {
  const stage = dealStage(packet);
  const ref = (hashNum(record.id) % 90000) + 10000;
  const fields = [
    { label: "Contact", value: `${buyerName(record)}${record.buyerEmail ? ` <${record.buyerEmail}>` : ""}` },
    { label: "Company", value: record.company || "—" },
    { label: "Deal stage", value: stage },
    {
      label: "Buying signals",
      value: packet.buyingSignals.length
        ? `${packet.buyingSignals.length} logged · ${truncate(packet.buyingSignals[0].title, 60)}`
        : "none logged",
    },
    { label: "Logged note", value: truncate(packet.summary, 140) },
    { label: "Queued email", value: packet.followUpEmail?.subject ?? "—" },
  ];
  return [
    {
      connector: "hubspot",
      sessionId: record.id,
      company: record.company,
      buyer: buyerName(record),
      title: `Deal updated → ${stage}`,
      detail: `${buyerName(record)} synced · ${packet.buyingSignals.length} buying signals logged`,
      externalRef: `https://app.hubspot.com/contacts/0/deal/${ref}`,
      fields,
    },
  ];
}

/** Clay: enrich the lead and build a multi-step follow-up sequence. */
export function buildClayActions(record: SessionRecord, packet: SessionPacket): DraftAction[] {
  const isNurture = !packet.labels.includes("hot") && !packet.labels.includes("follow_up_needed");
  const steps: string[] = [];
  steps.push(`Day 0 — Send recap email: "${packet.followUpEmail?.subject ?? "Thanks for the demo"}"`);
  if (packet.buyingSignals.length) steps.push(`Day 2 — Reinforce interest: ${truncate(packet.buyingSignals[0].title, 60)}`);
  steps.push(
    packet.objections.length
      ? `Day 4 — Address objection: ${truncate(packet.objections[0].title, 60)}`
      : "Day 4 — Share a relevant case study",
  );
  steps.push(
    packet.recommendedNextAction?.text
      ? `Day 7 — ${truncate(packet.recommendedNextAction.text, 70)}`
      : "Day 7 — Check in and offer to book a follow-up",
  );
  if (isNurture) steps.push("Day 14 — Nurture touch: product update + invite back");

  const persona = record.role ?? packet.buyerBackground[0]?.title ?? "unknown";
  const fields = [
    { label: "Enriched", value: `${record.company || "company"} · persona: ${persona}` },
    ...steps.map((text, i) => ({ label: `Step ${i + 1}`, value: text })),
  ];
  return [
    {
      connector: "clay",
      sessionId: record.id,
      company: record.company,
      buyer: buyerName(record),
      title: `${steps.length}-step follow-up sequence built`,
      detail: `Enriched ${record.company || "company"} · sequenced for ${buyerName(record)}`,
      fields,
    },
  ];
}

/** Linear: file one engineering ticket per grounded product/workflow gap. */
export function buildLinearActions(record: SessionRecord, packet: SessionPacket): DraftAction[] {
  const gaps: { insight: EvidenceInsight; kind: "product" | "workflow" }[] = [
    ...packet.productGaps.map((insight) => ({ insight, kind: "product" as const })),
    ...packet.workflowGaps.map((insight) => ({ insight, kind: "workflow" as const })),
  ];
  const replay = record.replayUrl ?? `session ${record.id}`;
  return gaps.slice(0, 4).map(({ insight, kind }) => {
    const ref = `DEM-${100 + (hashNum(record.id + insight.id) % 900)}`;
    const evidence = quotes(insight.evidence);
    return {
      connector: "linear" as ConnectorId,
      sessionId: record.id,
      company: record.company,
      buyer: buyerName(record),
      title: `Filed ${ref} · ${truncate(insight.title, 60)}`,
      detail: `${kind} gap from ${buyerName(record)} · ${evidence.length} evidence quote${evidence.length === 1 ? "" : "s"}`,
      externalRef: `https://linear.app/demoless/issue/${ref}`,
      fields: [
        { label: "Team", value: "Product" },
        { label: "Title", value: insight.title },
        { label: "Description", value: truncate(insight.detail, 200) || "Reported during a live demo." },
        { label: "Evidence", value: evidence.length ? evidence.map((q) => `“${q}”`).join("  ·  ") : "—" },
        { label: "Labels", value: kind === "product" ? "product-gap, from-demo" : "workflow-gap, from-demo" },
        { label: "Session", value: replay },
      ],
    };
  });
}

/** All outbound actions for a finished session, in feed order. */
export function buildActions(record: SessionRecord, packet: SessionPacket): DraftAction[] {
  return [
    ...buildHubspotActions(record, packet),
    ...buildClayActions(record, packet),
    ...buildLinearActions(record, packet),
  ];
}
