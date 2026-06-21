import type {
  EvidenceInsight,
  EvidenceRef,
  ExtractionStatus,
  SessionLabel,
  SessionPacket,
} from "@/lib/sessions/packet";

const LABEL_STYLE: Record<SessionLabel, string> = {
  hot: "bg-goodlit/15 text-goodlit",
  follow_up_needed: "bg-warnlit/15 text-warnlit",
  asked_pricing: "bg-warnlit/15 text-warnlit",
  asked_integration: "bg-brandlit2/15 text-brandlit2",
  product_gap: "bg-dangerlit/15 text-dangerlit",
  strong_pain: "bg-dangerlit/15 text-dangerlit",
  objection: "bg-slate2 text-ash",
  no_clear_next_step: "bg-slate2 text-ash",
};
const LABEL_TEXT: Record<SessionLabel, string> = {
  hot: "Hot",
  follow_up_needed: "Follow-up needed",
  asked_pricing: "Asked pricing",
  asked_integration: "Asked integration",
  product_gap: "Product gap",
  strong_pain: "Strong pain",
  objection: "Objection",
  no_clear_next_step: "No clear next step",
};

function EvidenceChips({ evidence }: { evidence: EvidenceRef[] }) {
  if (!evidence.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {evidence.map((e, i) =>
        e.kind === "quote" ? (
          <span key={i} className="rounded bg-slate2 px-2 py-0.5 font-mono text-[11px] text-ash">
            <span className="text-ember">{e.role === "user" ? "buyer" : "agent"}:</span> &quot;{e.text}&quot;
          </span>
        ) : (
          <span key={i} className="rounded bg-slate2 px-2 py-0.5 font-mono text-[11px] text-ash">
            ↪ {e.label}
          </span>
        )
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-[12px] border border-edge bg-slate p-4">
      <span className="mb-[8px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">{label}</span>
      {children}
    </div>
  );
}

function InsightSection({ label, items }: { label: string; items: EvidenceInsight[] }) {
  if (!items.length) return null;
  return (
    <Section label={label}>
      {items.map((it) => (
        <div key={it.id} className="mb-2 last:mb-0">
          <p className="m-0 text-[14px] font-semibold text-chalk">{it.title}</p>
          {it.detail && <p className="m-0 text-[13px] leading-[1.5] text-ash">{it.detail}</p>}
          <EvidenceChips evidence={it.evidence} />
        </div>
      ))}
    </Section>
  );
}

/**
 * Renders the evidence-backed post-demo packet (issue #21). Every insight shown
 * here survived the grounding gate; labels are derived in code. Falls through to
 * a factual status line while extraction is processing / failed / insufficient.
 */
export default function PacketPanel({
  status,
  packet,
}: {
  status?: ExtractionStatus;
  packet?: SessionPacket | null;
}) {
  if (!packet || status !== "ready") {
    const msg =
      status === "failed"
        ? "Packet extraction failed. The transcript and trace below are the captured evidence."
        : status === "insufficient_evidence"
          ? "Not enough conversation to generate a packet. Showing raw captured evidence only."
          : "Generating the post-demo packet… refresh in a moment.";
    return (
      <Section label="Post-demo packet">
        <p className="m-0 text-[14px] text-ash">{msg}</p>
      </Section>
    );
  }

  const p = packet;
  return (
    <div>
      {p.labels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {p.labels.map((l) => (
            <span key={l} className={`rounded px-2 py-1 text-[12px] font-semibold ${LABEL_STYLE[l]}`}>
              {LABEL_TEXT[l]}
            </span>
          ))}
        </div>
      )}

      {p.recommendedNextAction?.text && (
        <Section label="Recommended next action">
          <p className="m-0 text-[14px] text-ash">{p.recommendedNextAction.text}</p>
          <EvidenceChips evidence={p.recommendedNextAction.evidence} />
        </Section>
      )}

      {p.summary && (
        <Section label="Summary">
          <p className="m-0 text-[14px] leading-[1.6] text-ash">{p.summary}</p>
        </Section>
      )}

      <InsightSection label="Why they came" items={p.whyTheyCame} />
      <InsightSection label="Buying signals" items={p.buyingSignals} />
      <InsightSection label="Pain points" items={p.painPoints} />
      <InsightSection label="Buyer background" items={p.buyerBackground} />
      <InsightSection label="Workflow gaps" items={p.workflowGaps} />
      <InsightSection label="Product gaps" items={p.productGaps} />
      <InsightSection label="Objections" items={p.objections} />
      <InsightSection label="Questions" items={p.questions} />

      {p.productMoments.length > 0 && (
        <Section label="Product moments">
          {p.productMoments.map((m) => (
            <div key={m.id} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">{m.label}</p>
              <EvidenceChips evidence={m.evidence} />
            </div>
          ))}
        </Section>
      )}

      {p.followUpEmail && (
        <Section label="Draft follow-up email">
          <p className="m-0 text-[13px] font-semibold text-chalk">{p.followUpEmail.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-[1.6] text-ash">{p.followUpEmail.body}</pre>
        </Section>
      )}
    </div>
  );
}
