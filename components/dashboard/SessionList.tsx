import Link from "next/link";
import { SESSIONS } from "@/lib/dashboard/data";
import { listRecapSessions } from "@/lib/dashboard/source";
import { LABEL_TEXT, LABEL_CLASS, relativeTime } from "@/lib/dashboard/recapFormat";

// Left column on the Sessions surface. Prefers real recorded sessions (each row
// links to its recap, tagged with the recap label); falls back to the seeded
// mock corpus when Redis is empty/unavailable so the prototype still renders.
// Real rows intentionally omit mock-only metrics (lead score, qualified status).
export default async function SessionList({ selectedId }: { selectedId?: string }) {
  let real: Awaited<ReturnType<typeof listRecapSessions>> = [];
  try {
    real = await listRecapSessions(50);
  } catch {
    // Redis down — render the mock list below.
  }

  if (real.length > 0) {
    const now = Date.now();
    return (
      <div className="overflow-y-auto">
        {real.map((s) => {
          const on = s.id === selectedId;
          return (
            <Link
              key={s.id}
              href={`/dashboard/sessions/${s.id}`}
              className={
                "relative block border-b border-edge2 px-4 py-[11px] transition-colors " +
                (on ? "bg-slate2" : "hover:bg-slate")
              }
            >
              {on && <span className="absolute left-0 top-0 h-full w-[2.5px] bg-brandlit" />}
              <div className="flex items-center gap-2">
                <span
                  className={
                    "flex-none rounded-[5px] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.05em] " +
                    (s.label ? LABEL_CLASS[s.label] : "bg-slate2 text-ember")
                  }
                >
                  {s.label ? LABEL_TEXT[s.label] : "Analyzing"}
                </span>
                <span className="ml-auto flex-none font-mono text-[10px] text-ember">
                  {relativeTime(s.endedAt, now)}
                </span>
              </div>
              <div className={"mt-1 truncate text-[13px] " + (on ? "text-chalk" : "text-ash")}>
                {s.summary || "Recap pending…"}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-ember">{s.company}</div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {SESSIONS.map((s) => {
        const on = s.id === selectedId;
        return (
          <Link
            key={s.id}
            href={`/dashboard/sessions/${s.id}`}
            className={
              "relative block border-b border-edge2 px-4 py-[11px] transition-colors " +
              (on ? "bg-slate2" : "hover:bg-slate")
            }
            style={s.live ? { animation: "dlFade .3s ease both" } : undefined}
          >
            {on && (
              <span className="absolute left-0 top-0 h-full w-[2.5px] bg-brandlit" />
            )}
            <div className={"truncate text-[13px] font-semibold " + (on ? "text-chalk" : "text-ash")}>
              {s.buyer.email}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[12px] text-ember">{s.buyer.company}</span>
              {s.qualified && (
                <span className="rounded-[5px] bg-[#E6F4EA] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.05em] text-goodlit">
                  Qualified
                </span>
              )}
              <span className="ml-auto flex-none font-mono text-[10px] text-ember">
                {s.startedLabel}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
