import Link from "next/link";
import { notFound } from "next/navigation";
import { Group, SignalRow } from "@/components/dashboard/SignalGroup";
import { getBuyerSession, intentOf } from "@/lib/dashboard/data";

function scoreClass(n: number) {
  return n >= 80 ? "text-goodlit" : n >= 65 ? "text-brandlit2" : "text-warnlit";
}
function intentHex(n: number) {
  const i = intentOf(n);
  return i === "High" ? "#16A34A" : i === "Medium" ? "#C2710C" : "#8A94A2";
}

export default async function PersonDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = getBuyerSession(id);
  if (!s) notFound();
  const b = s.buyer;
  const objections = s.signals.filter((g) => g.type === "objection");

  const facts: [string, string][] = [
    ["Role", b.role],
    ["Company", b.company],
    ["Employees", b.employees],
    ["Industry", b.industry],
    ["Email", b.email],
    ["Source", s.source],
  ];

  return (
    <div className="dl-page mx-auto max-w-[860px] px-[34px] py-[26px] text-chalk">
      <Link
        href={`/dashboard/sessions/${s.id}`}
        className="font-mono text-[12px] font-semibold text-brandlit2 hover:text-brandlit"
      >
        ← Back to session
      </Link>

      <div className="mb-5 mt-3 flex items-center gap-[13px]">
        <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-slate2 font-mono text-[15px] font-bold text-brandlit2">
          {b.initials}
        </span>
        <div>
          <div className="text-[22px] font-extrabold tracking-[-0.02em] text-chalk">{b.name}</div>
          <div className="text-[13px] text-ember">
            {b.role} · {b.company}
          </div>
        </div>
        <Link
          href={`/dashboard/sessions/${s.id}`}
          className="ml-auto rounded-[9px] border border-edge px-3.5 py-2 text-[13px] font-semibold text-brandlit2 transition-colors hover:border-ember hover:text-chalk"
        >
          View session →
        </Link>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4">
        {/* who they are */}
        <div className="flex flex-col gap-4">
          <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
            <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
              Account
            </span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-[13px]">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ember">{k}</div>
                  <div className="mt-[3px] text-[14px] font-medium text-chalk">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
            <Group label="Objections">
              {objections.length ? (
                objections.map((g, i) => <SignalRow key={i} signal={g} />)
              ) : (
                <p className="m-0 text-[13px] text-ash">None raised — clean call.</p>
              )}
            </Group>
          </div>
        </div>

        {/* scorecard */}
        <div className="flex flex-col gap-4">
          <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
              Lead score
            </span>
            <div className={"dl-num font-mono text-[40px] font-bold leading-none " + scoreClass(s.score)}>
              {s.score}
              <span className="text-[15px] font-semibold text-ember">/100</span>
            </div>
            <div className="mb-1.5 mt-4 flex items-center justify-between text-[12px]">
              <span className="text-ash">Buying intent</span>
              <span className="font-mono font-semibold" style={{ color: intentHex(s.score) }}>
                {intentOf(s.score)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-obsidian">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.score}%`, background: intentHex(s.score) }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-ash">Status</span>
              <span className={"font-mono font-semibold " + (s.qualified ? "text-goodlit" : "text-ash")}>
                {s.qualified ? "Qualified" : "Unqualified"}
              </span>
            </div>
          </div>

          <div className="rounded-[14px] border border-brandlit/40 bg-gradient-to-b from-[#E7E8FB] to-slate p-[18px]">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-brandlit2">
              Recommended follow-up
            </span>
            <p className="mb-3.5 mt-0 text-[14px] leading-[1.5] text-chalk">{s.followUp.text}</p>
            <button className="w-full cursor-pointer rounded-[10px] border-none bg-brandlit p-[12px] text-[14px] font-bold text-obsidian transition-colors hover:bg-brandlit2">
              {s.followUp.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
