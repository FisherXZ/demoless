import Link from "next/link";
import { notFound } from "next/navigation";
import SessionList from "@/components/dashboard/SessionList";
import { Group, SignalRow } from "@/components/dashboard/SignalGroup";
import { getSession, fmtDuration, intentOf, kpis } from "@/lib/dashboard/data";
import RecapPanel from "@/components/dashboard/RecapPanel";
import {
  getRecapView,
  resolveDashboardMode,
  dashboardHref,
  getLiveSession,
  listLiveSessions,
  traceEventLabel,
  type RecapView,
  type LiveSessionView,
} from "@/lib/dashboard/source";
import { LABEL_CLASS, LABEL_TEXT, relativeTime } from "@/lib/dashboard/recapFormat";

function scoreClass(n: number) {
  return n >= 80 ? "text-goodlit" : n >= 65 ? "text-brandlit2" : "text-warnlit";
}
function intentClass(n: number) {
  const i = intentOf(n);
  return i === "High" ? "text-goodlit" : i === "Medium" ? "text-warnlit" : "text-ash";
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

  return (
    <>
      <Group label="Snapshot">
        <div className="mb-2 flex items-center text-[13px]">
          <span className="text-ash">Recap label</span>
          <span
            className={
              "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold " +
              LABEL_CLASS[recap.label]
            }
          >
            {LABEL_TEXT[recap.label]}
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, resolvedSearch] = await Promise.all([params, searchParams]);
  const mode = resolveDashboardMode(resolvedSearch);

  if (mode === "live") {
    const [session, sessions] = await Promise.all([getLiveSession(id), listLiveSessions(50)]);
    if (!session) notFound();
    return <LiveSessionDetail session={session} sessions={sessions} />;
  }

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

// ── live session detail — factual evidence only (no scores / qualification) ──

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center text-[13px] last:mb-0">
      <span className="text-ash">{label}</span>
      <span className="ml-auto max-w-[140px] truncate text-right font-mono font-semibold text-chalk">
        {value}
      </span>
    </div>
  );
}

function LiveSessionDetail({
  session,
  sessions,
}: {
  session: LiveSessionView;
  sessions: LiveSessionView[];
}) {
  const now = Date.now();
  return (
    <div className="flex h-screen flex-col text-chalk">
      <header className="flex flex-none items-center gap-[10px] border-b border-edge px-5 py-[14px]">
        <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">Sessions</span>
        <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
          {sessions.length} live records
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_252px]">
        {/* left — sessions list */}
        <div className="dl-scroll min-w-0 overflow-y-auto border-r border-edge">
          <SessionList selectedId={session.id} mode="live" sessions={sessions} />
        </div>

        {/* center — identity, replay, transcript */}
        <div className="dl-scroll min-w-0 overflow-y-auto px-6 py-[22px]">
          <div className="mb-[16px] flex items-center gap-[11px]">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-slate2 font-mono text-[13px] font-bold text-brandlit2">
              {session.buyer.initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-extrabold tracking-[-0.01em] text-chalk">
                {session.buyer.name}
              </div>
              <div className="truncate text-[12px] text-ember">
                {session.buyer.email} · {session.buyer.company}
              </div>
            </div>
            <Link
              href={dashboardHref(`/dashboard/people/${session.buyer.id}`, "live")}
              className="ml-auto flex-none rounded-[8px] border border-edge px-3 py-1.5 text-[12px] font-semibold text-brandlit2 transition-colors hover:border-ember hover:text-chalk"
            >
              View buyer →
            </Link>
          </div>

          {session.recapSummary ? (
            <div className="mb-4 rounded-[12px] border border-edge bg-slate p-4">
              <span className="mb-[8px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
                Recap summary
              </span>
              <p className="m-0 text-[14px] leading-[1.6] text-ash">{session.recapSummary}</p>
            </div>
          ) : (
            <div className="mb-4 rounded-[12px] border border-edge bg-slate p-4">
              <span className="mb-[8px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
                Recap
              </span>
              <p className="m-0 text-[14px] leading-[1.6] text-ash">
                No recap generated yet. This view shows raw captured evidence only —
                transcript, trace, and replay metadata.
              </p>
            </div>
          )}

          {/* replay status — real Browserbase link only when available */}
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[12px] border border-edge bg-[#0E1116]">
            <div className="dl-grid absolute inset-0 flex flex-col items-center justify-center gap-2 font-mono text-[11px] text-ember">
              <span>
                Browserbase replay · {session.replayStatus ?? (session.browserbaseSessionId ? "pending" : "unavailable")}
              </span>
              {session.replayUrl ? (
                <a
                  href={session.replayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brandlit2 hover:text-chalk"
                >
                  ▶ Open replay →
                </a>
              ) : (
                <span>{session.browserbaseSessionId || "No Browserbase session captured"}</span>
              )}
            </div>
            <div className="absolute left-[14px] top-3 flex items-center gap-1.5 font-mono text-[10px] text-white">
              <span
                className="h-[7px] w-[7px] rounded-full bg-dangerlit"
                style={{ animation: "dlBlink 1.4s ease infinite" }}
              />
              {session.isLive ? "LIVE" : session.status.toUpperCase()}
              {session.durationSec != null && ` · ${fmtDuration(session.durationSec)}`}
            </div>
          </div>

          {/* transcript — role "user" rendered as the visitor */}
          <div className="mt-4 rounded-[12px] border border-edge bg-slate p-4">
            <span className="mb-[10px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
              Transcript
            </span>
            <div className="flex flex-col gap-[10px]">
              {session.transcript.map((turn, i) => (
                <div key={i} className="rounded-[9px] border border-edge2 bg-[#EDF0F4] px-3 py-2">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ember">
                    {turn.role === "user" ? "Visitor" : "Agent"}
                  </div>
                  <div className="text-[13px] leading-[1.5] text-ash">{turn.text}</div>
                </div>
              ))}
              {session.transcript.length === 0 && (
                <p className="m-0 text-[13px] text-ash">No transcript turns captured yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* right — factual snapshot + trace */}
        <div className="dl-scroll min-w-0 overflow-y-auto border-l border-edge bg-[#EDF0F4] px-4 py-[18px]">
          <Group label="Snapshot">
            <Fact label="Status" value={session.isLive ? "Live" : session.status} />
            <Fact
              label="When"
              value={session.isLive ? "now" : relativeTime(session.whenTs, now)}
            />
            {session.durationSec != null && (
              <Fact label="Duration" value={fmtDuration(session.durationSec)} />
            )}
            <Fact label="Transcript" value={`${session.transcript.length} turns`} />
            <Fact label="Trace" value={`${session.events.length} events`} />
          </Group>

          <Group label="Browserbase">
            <Fact
              label="Replay"
              value={session.replayStatus ?? (session.browserbaseSessionId ? "pending" : "unavailable")}
            />
            <Fact label="Session id" value={session.browserbaseSessionId || "—"} />
            {session.language && <Fact label="Language" value={session.language} />}
          </Group>

          <Group label="Trace">
            <div className="flex flex-col gap-2">
              {session.events.map((e, i) => {
                const { kind, text } = traceEventLabel(e);
                return (
                  <div key={i} className="rounded-[8px] border border-edge2 bg-slate px-3 py-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ember">
                      {kind}
                    </div>
                    <div className="mt-1 break-words text-[13px] leading-[1.4] text-ash">{text}</div>
                  </div>
                );
              })}
              {session.events.length === 0 && (
                <p className="m-0 text-[13px] text-ash">No trace events captured yet.</p>
              )}
            </div>
          </Group>
        </div>
      </div>
    </div>
  );
}
