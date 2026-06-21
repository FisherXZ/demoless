"use client";

import { useState } from "react";
import type { TraceItem } from "@/lib/harness/useHarness";

function color(kind: string): string {
  if (kind === "error") return "text-danger";
  if (kind.startsWith("command:say")) return "text-branddeep";
  if (kind.startsWith("command:remember")) return "text-good";
  if (kind.startsWith("command:")) return "text-warn"; // navigate / click_or_type
  if (kind === "turn") return "text-indigotext";
  if (kind.startsWith("incoming:")) return "text-muted2";
  return "text-ink"; // outbound: user_said / start / reset
}

function clock(iso: string): string {
  return iso.slice(11, 19);
}

function Row({ item }: { item: TraceItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-hair">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-wash2"
      >
        <span className="w-3 text-faint">{item.dir === "out" ? "→" : "←"}</span>
        <span className={`font-mono text-[11px] font-600 ${color(item.kind)}`}>{item.kind}</span>
        <span className="ml-auto font-mono text-[10px] text-faint">{clock(item.at)}</span>
        <span className="w-3 text-faint">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <pre className="dl-scroll overflow-x-auto bg-wash px-3 py-2 font-mono text-[10px] leading-relaxed text-ink2">
          {JSON.stringify(item.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function TracePane({ trace }: { trace: TraceItem[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-mono text-[11px] font-700 uppercase tracking-wide text-muted">
          Trace
        </span>
        <span className="font-mono text-[10px] text-faint">{trace.length} events</span>
      </div>
      <div className="dl-scroll flex-1 overflow-y-auto">
        {trace.length === 0 ? (
          <p className="px-3 py-4 font-mono text-[11px] text-faint">
            No events yet. Start a run or send a message.
          </p>
        ) : (
          trace.map((item) => <Row key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
