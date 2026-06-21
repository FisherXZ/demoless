import type { Evidence, RecapReport } from "@/lib/sessions";
import type { RecapView } from "@/lib/dashboard/source";

const LABEL_STYLE: Record<RecapReport["label"], string> = {
  hot: "bg-goodlit/15 text-goodlit",
  follow_up_needed: "bg-warnlit/15 text-warnlit",
  nurture: "bg-slate2 text-ash",
};
const LABEL_TEXT: Record<RecapReport["label"], string> = {
  hot: "Hot",
  follow_up_needed: "Follow-up needed",
  nurture: "Nurture",
};

function EvidenceChips({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {evidence.map((e, i) =>
        e.kind === "quote" ? (
          <span key={i} className="rounded bg-slate2 px-2 py-0.5 font-mono text-[11px] text-ash">
            <span className="text-ember">{e.speaker === "user" ? "buyer" : "agent"}:</span> &quot;{e.text}&quot;
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

export default function RecapPanel({ view }: { view: RecapView }) {
  if (view.status !== "ready" || !view.recap) {
    return (
      <Section label="Recap">
        <p className="m-0 text-[14px] text-ash">Analyzing this session… refresh in a moment.</p>
      </Section>
    );
  }
  const r = view.recap;
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className={"rounded px-2 py-1 text-[12px] font-semibold " + LABEL_STYLE[r.label]}>{LABEL_TEXT[r.label]}</span>
        <EvidenceChips evidence={r.labelEvidence} />
      </div>

      <Section label="Summary">
        <p className="m-0 text-[14px] leading-[1.6] text-ash">{r.summary}</p>
      </Section>

      {r.whyTheyCame.text && (
        <Section label="Why they came">
          <p className="m-0 text-[14px] text-ash">{r.whyTheyCame.text}</p>
          <EvidenceChips evidence={r.whyTheyCame.evidence} />
        </Section>
      )}

      {r.buyingSignals.length > 0 && (
        <Section label="Buying signals">
          {r.buyingSignals.map((s, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">{s.text}</p>
              <EvidenceChips evidence={s.evidence} />
            </div>
          ))}
        </Section>
      )}

      {r.objectionsQuestions.length > 0 && (
        <Section label="Objections & questions">
          {r.objectionsQuestions.map((o, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">
                <span className="text-ember">[{o.kind}]</span> {o.text}
              </p>
              <EvidenceChips evidence={o.evidence} />
            </div>
          ))}
        </Section>
      )}

      {r.gaps.length > 0 && (
        <Section label="Workflow / product gaps">
          {r.gaps.map((g, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">{g.text}</p>
              <EvidenceChips evidence={g.evidence} />
            </div>
          ))}
        </Section>
      )}

      {r.nextAction.text && (
        <Section label="Recommended next action">
          <p className="m-0 text-[14px] text-ash">{r.nextAction.text}</p>
          <EvidenceChips evidence={r.nextAction.evidence} />
        </Section>
      )}

      <Section label="Draft follow-up email">
        <p className="m-0 text-[13px] font-semibold text-chalk">{r.draftEmail.subject}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-[1.6] text-ash">{r.draftEmail.body}</pre>
      </Section>
    </div>
  );
}
