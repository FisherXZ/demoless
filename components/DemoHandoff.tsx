"use client";

import { useEffect, useState } from "react";
import type { DemoVals } from "@/lib/types";

/**
 * Transition shown after the buyer ends the call, before the operator
 * dashboard. A "summary packet" is generated on the buyer's side and glides
 * across to the sales team's side, so the perspective shift (buyer → team)
 * reads as one continuous story. Kept in the product's light style
 * throughout — no theme change — consistent with the landing and dashboard.
 *
 * Self-driving: advances through phases on a slow timeline and calls
 * `vals.goDashboard()` when done (which routes to /dashboard). A Skip
 * control jumps there immediately.
 */

// Timeline (ms from mount). Each phase swaps copy and triggers the next move.
const PHASES = [0, 1300, 2900, 4500] as const;
const DONE_AT = 6100;

const CAPTIONS = [
  "Wrapping up your session",
  "Scoring what you cared about",
  "Sending it to your team",
  "Handed to your sales team",
];

export default function DemoHandoff({ vals }: { vals: DemoVals }) {
  const [phase, setPhase] = useState(0);
  const buyer = vals.form.name?.trim();

  useEffect(() => {
    const timers = PHASES.map((t, i) =>
      i === 0 ? null : setTimeout(() => setPhase(i), t),
    );
    const done = setTimeout(() => vals.goDashboard(), DONE_AT);
    return () => {
      timers.forEach((t) => t && clearTimeout(t));
      clearTimeout(done);
    };
    // Run the timeline once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arrived = phase >= 3; // packet docked at the sales-team side
  const traveling = phase >= 2; // packet has left the buyer side

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-obsidian">
      <style>{keyframes}</style>

      {/* Large, readable caption */}
      <div className="mb-14 h-[2.6em] px-6 text-center">
        <span
          key={phase}
          className="font-serif font-medium tracking-[-0.01em]"
          style={{
            color: "#0E1116",
            fontSize: "clamp(28px, 4.2vw, 46px)",
            lineHeight: 1.1,
            animation: "hoFade 600ms ease",
            display: "inline-block",
          }}
        >
          {CAPTIONS[phase]}
        </span>
      </div>

      {/* Journey: [You] ——track—— [Sales team], packet glides across */}
      <div className="relative h-[200px] w-[min(840px,88vw)]">
        {/* track line */}
        <div
          className="absolute left-[14%] right-[14%] top-1/2 h-[2px] -translate-y-1/2 rounded-full"
          style={{ background: "#E3E7EC" }}
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background: "#3A41D6",
              transformOrigin: "left",
              transform: `scaleX(${traveling ? 1 : 0})`,
              transition: "transform 1400ms cubic-bezier(0.5,0,0.2,1)",
            }}
          />
        </div>

        {/* Buyer node (left) */}
        <Endpoint
          side="left"
          label="You"
          active={!traveling}
        >
          <span
            className="block h-[16px] w-[16px] rounded-full"
            style={{ background: "#3A41D6", animation: "hoPulse 2.4s ease-in-out infinite" }}
          />
        </Endpoint>

        {/* Sales-team node (right) */}
        <Endpoint side="right" label="Sales team" active={arrived}>
          <div className="flex items-end gap-[3px]">
            {[10, 16, 13].map((h, i) => (
              <span
                key={i}
                className="w-[4px] rounded-[2px]"
                style={{
                  height: arrived ? h : 4,
                  background: arrived ? "#3A41D6" : "#C7CCD6",
                  transition: `height 500ms ease ${i * 100}ms, background 500ms ease`,
                }}
              />
            ))}
          </div>
        </Endpoint>

        {/* Summary packet — glides left → right along the track */}
        <div
          className="absolute top-1/2"
          style={{
            left: traveling ? "82%" : "18%",
            transform: "translate(-50%, -50%)",
            opacity: arrived ? 0 : 1,
            transition:
              "left 1400ms cubic-bezier(0.5,0,0.2,1), opacity 500ms ease 200ms",
          }}
        >
          <div
            className="w-[214px] rounded-[16px] bg-white p-4"
            style={{
              border: "1px solid #D2D4F2",
              boxShadow: "0 14px 40px -18px rgba(58,65,214,0.45)",
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "#3A41D6" }}>✦</span>
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "#2A2FA8" }}
              >
                Session summary
              </span>
            </div>
            <div className="mt-3 space-y-[10px]">
              {["86%", "62%", "74%"].map((w, i) => (
                <span key={w} className="block h-[6px] rounded-full" style={{ background: "#EDF0F4" }}>
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: phase >= 1 ? w : "0%",
                      background: "#3A41D6",
                      transition: `width 800ms ease ${i * 140}ms`,
                    }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Docked scored-session card, reveals when the packet arrives */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2"
          style={{
            opacity: arrived ? 1 : 0,
            transform: `translateY(-50%) translateX(${arrived ? "0" : "16px"})`,
            transition: "opacity 600ms ease 250ms, transform 600ms ease 250ms",
            pointerEvents: "none",
          }}
        >
          <div
            className="w-[230px] rounded-[16px] bg-white p-4"
            style={{ border: "1px solid #E3E7EC", boxShadow: "0 16px 44px -22px rgba(20,30,50,0.3)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: "#0E1116" }}>
                New scored session
              </span>
              <span
                className="rounded-full px-2 py-[2px] text-[11px] font-semibold"
                style={{ background: "#E6F4EA", color: "#16A34A" }}
              >
                Qualified
              </span>
            </div>
            <div className="mt-3 h-[8px] w-full rounded-full" style={{ background: "#EDF0F4" }}>
              <span
                className="block h-full rounded-full"
                style={{
                  width: arrived ? "82%" : "0%",
                  background: "#3A41D6",
                  transition: "width 800ms ease 500ms",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* buyer sign-off, large + readable */}
      <div
        className="mt-12 text-center font-serif"
        style={{
          color: "#525B68",
          fontSize: "clamp(16px, 1.8vw, 20px)",
          opacity: arrived ? 0 : 1,
          transition: "opacity 500ms ease",
        }}
      >
        {buyer ? `Nice talking, ${buyer}` : "Thanks for stopping by"}
      </div>

      {/* Skip */}
      <button
        onClick={() => vals.goDashboard()}
        className="absolute bottom-7 right-8 cursor-pointer border-none bg-transparent p-2 text-[14px] font-medium"
        style={{ color: "#657080" }}
      >
        Skip to dashboard →
      </button>
    </div>
  );
}

function Endpoint({
  side,
  label,
  active,
  children,
}: {
  side: "left" | "right";
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-3"
      style={{ [side]: 0 }}
    >
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white"
        style={{
          border: `1px solid ${active ? "#3A41D6" : "#E3E7EC"}`,
          boxShadow: active ? "0 0 0 5px #E7E8FB" : "0 8px 24px -16px rgba(20,30,50,0.25)",
          transition: "border-color 500ms ease, box-shadow 500ms ease",
        }}
      >
        {children}
      </div>
      <span
        className="text-[13px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: active ? "#2A2FA8" : "#657080", transition: "color 500ms ease" }}
      >
        {label}
      </span>
    </div>
  );
}

const keyframes = `
@keyframes hoPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.6; }
}
@keyframes hoFade {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
