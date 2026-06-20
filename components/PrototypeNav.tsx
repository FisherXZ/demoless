"use client";

import type { DemoVals, Screen } from "@/lib/types";

export default function PrototypeNav({ vals }: { vals: DemoVals }) {
  const items: { label: string; screen: Screen; onClick: () => void }[] = [
    { label: "Landing", screen: "landing", onClick: vals.goLanding },
    { label: "Form", screen: "form", onClick: vals.goForm },
    { label: "Demo room", screen: "room", onClick: vals.startDemo },
    { label: "Dashboard", screen: "dashboard", onClick: vals.goDashboard },
  ];

  return (
    <div className="fixed left-4 bottom-4 z-50 flex items-center gap-1 bg-[rgba(28,28,26,0.92)] backdrop-blur-md p-1.5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
      <span className="text-[10px] text-faint2 font-mono px-2 pl-1.5 tracking-[0.05em]">
        PROTOTYPE
      </span>
      {items.map((it) => (
        <button
          key={it.screen}
          onClick={it.onClick}
          className="border-0 cursor-pointer px-[13px] py-[7px] rounded-full text-xs font-semibold text-white"
          style={{
            background: vals.screen === it.screen ? "#4f46e5" : "transparent",
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
