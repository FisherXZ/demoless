import Link from "next/link";
import { SESSIONS, intentOf } from "@/lib/dashboard/data";

function scoreClass(n: number) {
  return n >= 80 ? "text-goodlit" : n >= 65 ? "text-brandlit2" : "text-warnlit";
}

export default function PeoplePage() {
  return (
    <div className="flex h-screen flex-col text-chalk">
      <header className="flex flex-none items-center gap-[10px] border-b border-edge px-[34px] py-[14px]">
        <span className="text-[15px] font-extrabold tracking-[-0.01em]">People</span>
        <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
          {SESSIONS.length} buyers
        </span>
      </header>
      <div className="dl-scroll-dark min-h-0 flex-1 overflow-y-auto px-[34px] py-5">
        <div className="overflow-hidden rounded-[14px] border border-edge bg-slate">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_0.6fr_0.6fr] bg-[#101010] px-4 py-[11px] font-mono text-[10px] uppercase tracking-[0.1em] text-ember">
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
