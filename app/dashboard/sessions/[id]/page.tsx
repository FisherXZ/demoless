import Link from "next/link";
import { notFound } from "next/navigation";
import SessionList from "@/components/dashboard/SessionList";
import { Group, SignalRow } from "@/components/dashboard/SignalGroup";
import { getSession, fmtDuration, intentOf, kpis } from "@/lib/dashboard/data";
import RecapPanel from "@/components/dashboard/RecapPanel";
import { getRecapView, type RecapView } from "@/lib/dashboard/source";
import type { RecapReport } from "@/lib/sessions";

function scoreClass(n: number) {
  return n >= 80 ? "text-goodlit" : n >= 65 ? "text-brandlit2" : "text-warnlit";
}
function intentClass(n: number) {
  const i = intentOf(n);
  return i === "High" ? "text-goodlit" : i === "Medium" ? "text-warnlit" : "text-ash";
}

function recapLabelText(label: RecapReport["label"]): string {
  if (label === "hot") return "Hot";
  if (label === "follow_up_needed") return "Follow-up";
  return "Nurture";
}

function recapScore(label: RecapReport["label"]): number {
  if (label === "hot") return 86;
  if (label === "follow_up_needed") return 68;
  return 42;
}

function recapScoreClass(label: RecapReport["label"]): string {
  if (label === "hot") return "text-goodlit";
  if (label === "follow_up_needed") return "text-warnlit";
  return "text-ash";
}

function RealRecapRail({ view }: { view: RecapView }) {
  const recap = view.recap;

  if (!recap) {
    return (
      <>
        <Group label="Snapshot">
          <div className="mb-2 flex items-center text-[13px]">
            <span className="text-ash">Status</span>
            <span className="ml-auto font-mono font-semibold text-warnlit">Analyzing</span>
          </div>
          <p className="m-0 text-[13px] leading-[1.45] text-ash">
            Recap is still processing. Keep the replay link visible and refresh after analysis completes.
          </p>
        </Group>
        <Group label="Evidence">
          <SignalRow signal={{ type: "question", value: "No scored signals available yet.", at: "" }} />
        </Group>
      </>
    );
  }

  const score = recapScore(recap.label);

  return (
    <>
      <Group label="Snapshot">
        <div className="mb-2 flex items-center text-[13px]">
          <span className="text-ash">Recap label</span>
          <span className={"ml-auto font-mono font-semibold " + recapScoreClass(recap.label)}>
            {recapLabelText(recap.label)}
          </span>
        </div>
        <div className="mb-2 flex items-center text-[13px]">
          <span className="text-ash">Demo score</span>
          <span className={"dl-num ml-auto font-mono text-[26px] font-semibold " + recapScoreClass(recap.label)}>
            {score}
          </span>
        </div>
        <div className="flex items-center text-[13px]">
          <span className="text-ash">Evidence</span>
          <span className="ml-auto font-mono font-semibold text-chalk">
            {recap.labelEvidence.length} cited
          </span>
        </div>
      </Group>

      <Group label="Buyer signals">
        {recap.buyingSignals.slice(0, 3).map((signal, i) => (
          <SignalRow key={i} signal={{ type: "interest", value: signal.text, at: "" }} />
        ))}
        {recap.buyingSignals.length === 0 && (
          <SignalRow signal={{ type: "question", value: "No buying signals captured.", at: "" }} />
        )}
      </Group>

      <Group label="Objections and questions">
        {recap.objectionsQuestions.slice(0, 3).map((item, i) => (
          <SignalRow
            key={i}
            signal={{
              type: item.kind === "objection" ? "objection" : "question",
              value: item.text,
              at: "",
            }}
          />
        ))}
        {recap.objectionsQuestions.length === 0 && (
          <SignalRow signal={{ type: "interest", value: "No objections captured.", at: "" }} />
        )}
      </Group>

      {recap.nextAction.text && (
        <Group label="Next action">
          <SignalRow signal={{ type: "role", value: recap.nextAction.text, at: "" }} />
        </Group>
      )}
    </>
  );
}

export default async function SessionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getRecapView(id);
  if (view) {
    // Real recorded session: sessions rail + the evidence-backed recap.
    // No mock-only metrics column (lead score / intent / signals / decision makers).
    return (
      <div className="flex h-screen flex-col text-chalk">
        <header className="flex flex-none items-center gap-[10px] border-b border-edge px-5 py-[14px]">
          <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">Sessions</span>
          <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
            {view.record.company}
          </span>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_252px]">
          {/* left — sessions list */}
          <div className="dl-scroll min-w-0 overflow-y-auto border-r border-edge">
            <SessionList selectedId={view.record.id} />
          </div>
          {/* center — the recap */}
          <div className="dl-scroll min-w-0 overflow-y-auto px-6 py-[22px]">
            <div className="mx-auto max-w-[760px]">
              {view.record.replayUrl && (
                <a
                  href={view.record.replayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-block rounded-[8px] border border-edge px-3 py-1.5 text-[12px] font-semibold text-brandlit2 hover:border-ember hover:text-chalk"
                >
                  ▶ Open Browserbase replay →
                </a>
              )}
              <RecapPanel view={view} />
            </div>
          </div>
          <div className="dl-scroll min-w-0 overflow-y-auto border-l border-edge bg-[#EDF0F4] px-4 py-[18px]">
            <RealRecapRail view={view} />
          </div>
        </div>
      </div>
    );
  }
  // Fall back to the seeded mock prototype for ids that aren't real sessions.
  const s = getSession(id);
  if (!s) notFound();
  const k = kpis();

  return (
    <div className="flex h-screen flex-col text-chalk">
      <header className="flex flex-none items-center gap-[10px] border-b border-edge px-5 py-[14px]">
        <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">Sessions</span>
        <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
          {k.total} total · {k.qualified} qualified
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_252px]">
        {/* left — sessions list */}
        <div className="dl-scroll min-w-0 overflow-y-auto border-r border-edge">
          <SessionList selectedId={s.id} />
        </div>

        {/* center — the call */}
        <div className="dl-scroll min-w-0 overflow-y-auto px-6 py-[22px]">
          <div className="mb-[16px] flex items-center gap-[11px]">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-slate2 font-mono text-[13px] font-bold text-brandlit2">
              {s.buyer.initials}
            </span>
            <div className="min-w-0">
              <div className="text-[18px] font-extrabold tracking-[-0.01em] text-chalk">
                {s.buyer.name}
              </div>
              <div className="truncate text-[12px] text-ember">
                {s.buyer.role} · {s.buyer.company} · {s.buyer.employees} employees
              </div>
            </div>
            <Link
              href={`/dashboard/people/${s.buyer.id}`}
              className="ml-auto flex-none rounded-[8px] border border-edge px-3 py-1.5 text-[12px] font-semibold text-brandlit2 transition-colors hover:border-ember hover:text-chalk"
            >
              View buyer →
            </Link>
          </div>

          <div className="mb-4 rounded-[12px] border border-edge bg-slate p-4">
            <span className="mb-[8px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
              AI call summary
            </span>
            <p className="m-0 text-[14px] leading-[1.6] text-ash">{s.summary}</p>
          </div>

          {/* replay player */}
          <div className="relative aspect-video overflow-hidden rounded-[12px] border border-edge bg-[#0E1116]">
            <div className="dl-grid absolute inset-0 flex items-center justify-center font-mono text-[11px] text-ember">
              ▶ Browserbase session replay · {fmtDuration(s.durationSec)}
            </div>
            <div className="absolute left-[14px] top-3 flex items-center gap-1.5 font-mono text-[10px] text-white">
              <span className="h-[7px] w-[7px] rounded-full bg-dangerlit" style={{ animation: "dlBlink 1.4s ease infinite" }} />
              REC {fmtDuration(s.durationSec)}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-[11px] bg-gradient-to-t from-black/80 to-transparent px-[14px] py-[12px]">
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-white text-[12px] text-[#0E1116]">
                ▶
              </span>
              <div className="relative h-[3px] flex-1 rounded bg-white/20">
                <span className="absolute inset-y-0 left-0 w-[42%] rounded bg-brandlit" />
              </div>
              <span className="dl-num font-mono text-[11px] text-white">
                01:46 / {fmtDuration(s.durationSec)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-[9px] rounded-[9px] border border-edge bg-slate px-3 py-[10px]">
            <span className="text-ember">⌕</span>
            <span className="font-mono text-[12px] text-ember">Search transcript…</span>
          </div>
        </div>

        {/* right — signals */}
        <div className="dl-scroll min-w-0 overflow-y-auto border-l border-edge bg-[#EDF0F4] px-4 py-[18px]">
          <Group label="Snapshot">
            <div className="mb-2 flex items-center text-[13px]">
              <span className="text-ash">Lead score</span>
              <span className={"dl-num ml-auto font-mono text-[26px] font-semibold " + scoreClass(s.score)}>
                {s.score}
              </span>
            </div>
            <div className="mb-2 flex items-center text-[13px]">
              <span className="text-ash">Intent</span>
              <span className={"ml-auto font-mono font-semibold " + intentClass(s.score)}>
                {intentOf(s.score)}
              </span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="text-ash">Status</span>
              <span
                className={
                  "ml-auto font-mono font-semibold " + (s.qualified ? "text-goodlit" : "text-ash")
                }
              >
                {s.qualified ? "Qualified" : "Unqualified"}
              </span>
            </div>
          </Group>

          <Group label="Buyer signals">
            {s.signals.map((g, i) => (
              <SignalRow key={i} signal={g} />
            ))}
          </Group>

          <Group label="Opportunities">
            {s.opportunities.map((o, i) => (
              <SignalRow key={i} signal={{ type: "interest", value: o, at: "" }} />
            ))}
          </Group>

          <Group label="Decision makers">
            {s.decisionMakers.map((d, i) => (
              <SignalRow key={i} signal={{ type: "role", value: d, at: "" }} />
            ))}
          </Group>
        </div>
      </div>
    </div>
  );
}
