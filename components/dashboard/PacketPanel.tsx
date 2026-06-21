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

// Headline categories shown as the empty scaffold while extraction is pending.
const PENDING_SECTIONS = [
  "Recommended next action",
  "Summary",
  "Why they came",
  "Buying signals",
  "Pain points",
  "Objections",
  "Questions",
];

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

// One Granola-style block: a heading + tight bullet list, inline in the document.
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-[7px] flex items-center gap-[7px] text-[13px] font-semibold text-chalk">
      <span className="h-[10px] w-[2px] flex-none rounded-full bg-brandlit/50" />
      {children}
    </h4>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-[9px] text-[14px] leading-[1.5]">
      <span className="mt-[8px] h-[4px] w-[4px] flex-none rounded-full bg-stone300" />
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function InsightBlock({ heading, items }: { heading: string; items: EvidenceInsight[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-5 last:mb-0">
      <Heading>{heading}</Heading>
      <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
        {items.map((it) => (
          <Bullet key={it.id}>
            <span className="font-medium text-chalk">{it.title}</span>
            {it.detail && <span className="text-ash"> — {it.detail}</span>}
            <EvidenceChips evidence={it.evidence} />
          </Bullet>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders the evidence-backed Demoless insights (issue #21) as a single
 * Granola-style structured document. Every insight shown survived the grounding
 * gate; labels are derived in code. While extraction is pending / failed /
 * insufficient, the same categories render as an empty scaffold.
 */
export default function PacketPanel({
  status,
  packet,
}: {
  status?: ExtractionStatus;
  packet?: SessionPacket | null;
}) {
  const ready = Boolean(packet) && status === "ready";
  const pending = !ready && status !== "failed" && status !== "insufficient_evidence";

  return (
    <div className="mb-4 rounded-[12px] border border-edge bg-slate p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
          Demoless insights
        </span>
        {pending && <span className="dl-live-dot h-[6px] w-[6px] rounded-full bg-livelit" />}
      </div>

      {ready && packet ? (
        <ReadyDoc packet={packet} />
      ) : (
        <PendingDoc pending={pending} status={status} />
      )}
    </div>
  );
}

function ReadyDoc({ packet: p }: { packet: SessionPacket }) {
  const nextAction: EvidenceInsight[] = p.recommendedNextAction?.text
    ? [
        {
          id: "next-action",
          type: "buying_signal",
          title: p.recommendedNextAction.text,
          detail: "",
          evidence: p.recommendedNextAction.evidence,
        },
      ]
    : [];

  return (
    <div>
      {p.labels.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {p.labels.map((l) => (
            <span key={l} className={`rounded px-2 py-1 text-[12px] font-semibold ${LABEL_STYLE[l]}`}>
              {LABEL_TEXT[l]}
            </span>
          ))}
        </div>
      )}

      <InsightBlock heading="Recommended next action" items={nextAction} />

      {p.summary && (
        <div className="mb-5 last:mb-0">
          <Heading>Summary</Heading>
          <p className="m-0 pl-[13px] text-[14px] leading-[1.6] text-ash">{p.summary}</p>
        </div>
      )}

      <InsightBlock heading="Why they came" items={p.whyTheyCame} />
      <InsightBlock heading="Buying signals" items={p.buyingSignals} />
      <InsightBlock heading="Pain points" items={p.painPoints} />
      <InsightBlock heading="Buyer background" items={p.buyerBackground} />
      <InsightBlock heading="Workflow gaps" items={p.workflowGaps} />
      <InsightBlock heading="Product gaps" items={p.productGaps} />
      <InsightBlock heading="Objections" items={p.objections} />
      <InsightBlock heading="Questions" items={p.questions} />

      {p.productMoments.length > 0 && (
        <div className="mb-5 last:mb-0">
          <Heading>Product moments</Heading>
          <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
            {p.productMoments.map((m) => (
              <Bullet key={m.id}>
                <span className="text-ash">{m.label}</span>
                <EvidenceChips evidence={m.evidence} />
              </Bullet>
            ))}
          </ul>
        </div>
      )}

      {p.followUpEmail && (
        <div className="last:mb-0">
          <Heading>Draft follow-up email</Heading>
          <div className="pl-[13px]">
            <p className="m-0 text-[13px] font-semibold text-chalk">{p.followUpEmail.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-[1.6] text-ash">
              {p.followUpEmail.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingDoc({ pending, status }: { pending: boolean; status?: ExtractionStatus }) {
  const note =
    status === "failed"
      ? "Insight extraction failed — the transcript and trace below are the captured evidence."
      : status === "insufficient_evidence"
        ? "Not enough conversation yet to fill these in. The transcript and trace below are the captured evidence."
        : "Pulling Demoless insights from this demo… these fill in shortly.";
  return (
    <div>
      <p className="mb-5 mt-0 text-[13px] text-ash">{note}</p>
      {PENDING_SECTIONS.map((label) => (
        <div key={label} className="mb-[18px] last:mb-0">
          <Heading>{label}</Heading>
          {pending ? (
            <div className="flex flex-col gap-2 pl-[13px]">
              <div className="h-[9px] w-3/4 animate-pulse rounded bg-slate2" />
              <div className="h-[9px] w-1/2 animate-pulse rounded bg-slate2" />
            </div>
          ) : (
            <p className="m-0 pl-[13px] text-[13px] text-ember">—</p>
          )}
        </div>
      ))}
    </div>
  );
}
