import Link from "next/link";
import { SESSIONS, intentOf } from "@/lib/dashboard/data";
import {
  resolveDashboardMode,
  dashboardHref,
  listLivePeople,
  type LivePersonView,
} from "@/lib/dashboard/source";
import { relativeTime } from "@/lib/dashboard/recapFormat";

function scoreClass(n: number) {
  return n >= 80 ? "text-goodlit" : n >= 65 ? "text-brandlit2" : "text-warnlit";
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const mode = resolveDashboardMode(await searchParams);
  if (mode === "live") return <LivePeoplePage />;
  return <DemoPeoplePage />;
}

// ── live people — factual buyer directory (no scores / intent / qualification) ─

async function LivePeoplePage() {
  let people: LivePersonView[] = [];
  try {
    people = await listLivePeople(100);
  } catch {
    // Redis down — render the empty state below.
  }
  const now = Date.now();

  return (
    <div className="flex h-screen flex-col text-chalk">
      <header className="flex flex-none items-center gap-[10px] border-b border-edge px-[34px] py-[14px]">
        <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">People</span>
        <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
          {people.length} buyers
        </span>
      </header>
      <div className="dl-scroll min-h-0 flex-1 overflow-y-auto px-[34px] py-5">
        {people.length === 0 ? (
          <div className="mx-auto mt-10 max-w-[440px] rounded-[14px] border border-edge bg-slate p-6 text-center">
            <div className="font-serif text-[22px] font-medium text-chalk">No buyers yet</div>
            <p className="mb-0 mt-2 text-[13px] leading-[1.6] text-ash">
              Start a demo with a verified work email, then return here with Live mode on.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-edge bg-slate">
            <div className="grid grid-cols-[1.8fr_1fr_0.7fr_0.7fr] bg-[#EDF0F4] px-4 py-[11px] font-mono text-[10px] uppercase tracking-[0.1em] text-ember">
              <span>Buyer</span>
              <span>Company</span>
              <span className="text-right">Sessions</span>
              <span className="text-right">Last seen</span>
            </div>
            {people.map((p) => (
              <Link
                key={p.id}
                href={dashboardHref(`/dashboard/people/${p.id}`, "live")}
                className="grid grid-cols-[1.8fr_1fr_0.7fr_0.7fr] items-center border-t border-edge2 px-4 py-[13px] text-[13px] transition-colors hover:bg-slate2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] bg-slate2 font-mono text-[10px] font-bold text-brandlit2">
                    {p.initials}
                  </span>
                  <span className="min-w-0 truncate font-semibold text-chalk">{p.email}</span>
                </span>
                <span className="truncate text-ash">{p.company}</span>
                <span className="dl-num text-right font-mono text-ash">{p.sessionCount}</span>
                <span className="text-right font-mono text-[12px] text-ember">
                  {relativeTime(p.lastSeenTs, now)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── demo people — the existing seeded directory (unchanged) ──────────────────

function DemoPeoplePage() {
  return (
    <div className="flex h-screen flex-col text-chalk">
      <header className="flex flex-none items-center gap-[10px] border-b border-edge px-[34px] py-[14px]">
        <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">People</span>
        <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
          {SESSIONS.length} buyers
        </span>
      </header>
      <div className="dl-scroll min-h-0 flex-1 overflow-y-auto px-[34px] py-5">
        <div className="overflow-hidden rounded-[14px] border border-edge bg-slate">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_0.6fr_0.6fr] bg-[#EDF0F4] px-4 py-[11px] font-mono text-[10px] uppercase tracking-[0.1em] text-ember">
            <span>Buyer</span>
            <span>Company</span>
            <span>Role</span>
            <span>Intent</span>
            <span className="text-right">Score</span>
          </div>
          {SESSIONS.map((s) => (
            <Link
              key={s.buyer.id}
              href={`/dashboard/people/${s.buyer.id}`}
              className="grid grid-cols-[1.6fr_1fr_1fr_0.6fr_0.6fr] items-center border-t border-edge2 px-4 py-[13px] text-[13px] transition-colors hover:bg-slate2"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] bg-slate2 font-mono text-[10px] font-bold text-brandlit2">
                  {s.buyer.initials}
                </span>
                <span className="font-semibold text-chalk">{s.buyer.name}</span>
              </span>
              <span className="text-ash">{s.buyer.company}</span>
              <span className="text-ash">{s.buyer.role}</span>
              <span className="font-mono text-ash">{intentOf(s.score)}</span>
              <span className={"dl-num text-right font-mono font-bold " + scoreClass(s.score)}>
                {s.score}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
