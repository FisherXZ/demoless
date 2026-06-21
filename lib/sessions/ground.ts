// The integrity gate: every insight must be backed by evidence we can verify
// against the recorded trace. Quotes must appear (whitespace/case-normalized) in
// a transcript turn; actions must match a recorded page visit / agent action.
// Anything unverifiable is dropped here, before storage — never trust the model.
import type {
  Evidence,
  RecapReport,
  RecapLabel,
  SessionRecord,
} from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Returns a corrected Evidence (with real turn/ts/speaker) or null if unverifiable. */
export function verifyEvidence(ev: Evidence, record: SessionRecord): Evidence | null {
  if (ev.kind === "quote") {
    const want = normalize(ev.text);
    if (!want) return null;
    const bySpeaker = record.transcript.find(
      (t) => t.role === ev.speaker && normalize(t.text).includes(want)
    );
    const anyTurn = bySpeaker ?? record.transcript.find((t) => normalize(t.text).includes(want));
    if (!anyTurn) return null;
    return { kind: "quote", speaker: anyTurn.role, text: ev.text.trim(), turn: anyTurn.turn, ts: anyTurn.ts };
  }
  // action evidence: match label against a recorded page_visited url or agent_action detail.
  const want = normalize(ev.label);
  if (!want) return null;
  const hit = record.events.find(
    (e) =>
      (e.kind === "page_visited" && normalize(e.url).includes(want)) ||
      (e.kind === "agent_action" && normalize(e.detail).includes(want))
  );
  if (!hit) return null;
  return { kind: "action", label: ev.label.trim(), ts: hit.ts };
}

export function groundEvidenceList(list: Evidence[], record: SessionRecord): Evidence[] {
  return (list ?? [])
    .map((e) => verifyEvidence(e, record))
    .filter((e): e is Evidence => e !== null);
}

function groundItem<T extends { evidence: Evidence[] }>(item: T, record: SessionRecord): T | null {
  const evidence = groundEvidenceList(item.evidence, record);
  return evidence.length ? { ...item, evidence } : null;
}

/** Ground every insight; drop the ungrounded; recompute the label from survivors. */
export function groundInsights(report: RecapReport, record: SessionRecord): RecapReport {
  const buyingSignals = (report.buyingSignals ?? [])
    .map((s) => groundItem(s, record))
    .filter((s): s is RecapReport["buyingSignals"][number] => s !== null);
  const objectionsQuestions = (report.objectionsQuestions ?? [])
    .map((o) => groundItem(o, record))
    .filter((o): o is RecapReport["objectionsQuestions"][number] => o !== null);
  const gaps = (report.gaps ?? [])
    .map((g) => groundItem(g, record))
    .filter((g): g is RecapReport["gaps"][number] => g !== null);

  const whyEv = groundEvidenceList(report.whyTheyCame?.evidence ?? [], record);
  const nextEv = groundEvidenceList(report.nextAction?.evidence ?? [], record);
  let labelEvidence = groundEvidenceList(report.labelEvidence ?? [], record);

  // A hot / follow_up_needed label requires a surviving buying signal AND grounded
  // label evidence; otherwise it's nurture.
  let label: RecapLabel = report.label;
  if (label !== "nurture" && (buyingSignals.length === 0 || labelEvidence.length === 0)) {
    label = "nurture";
    labelEvidence = [];
  }

  return {
    ...report,
    label,
    labelEvidence,
    whyTheyCame: { text: report.whyTheyCame?.text ?? "", evidence: whyEv },
    buyingSignals,
    objectionsQuestions,
    gaps,
    nextAction: { text: report.nextAction?.text ?? "", evidence: nextEv },
  };
}
