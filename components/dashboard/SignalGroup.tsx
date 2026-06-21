import type { Signal } from "@/lib/dashboard/data";
import { SIGNAL_GLYPH } from "@/lib/dashboard/data";

const GLYPH_CLS: Record<string, string> = {
  int: "bg-[#0f2a1d] text-goodlit",
  obj: "bg-[#2e2110] text-warnlit",
  neu: "bg-slate2 text-ash",
};

export function SignalRow({ signal }: { signal: Signal }) {
  const g = SIGNAL_GLYPH[signal.type];
  return (
    <div className="mb-[9px] flex items-start gap-[10px] text-[13px] leading-[1.45] text-ash">
      <span
        className={
          "mt-px flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[5px] font-mono text-[10px] " +
          GLYPH_CLS[g.cls]
        }
      >
        {g.mark}
      </span>
      <span className="flex-1">{signal.value}</span>
      {signal.at && <span className="flex-none font-mono text-[10px] text-ember">{signal.at}</span>}
    </div>
  );
}

export function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px]">
      <span className="mb-[10px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
        {label}
      </span>
      {children}
    </div>
  );
}
