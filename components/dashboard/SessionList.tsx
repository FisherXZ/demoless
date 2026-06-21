import Link from "next/link";
import { SESSIONS } from "@/lib/dashboard/data";

// Left column on the Sessions surface. The live on-stage session appends at the
// top with a dlFade entrance; the selected row gets the indigo tint + left-border.
export default function SessionList({ selectedId }: { selectedId?: string }) {
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
