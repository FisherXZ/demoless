"use client";

import { useEffect } from "react";
import type { DemoVals } from "@/lib/types";
import { useAgentName } from "@/lib/voice/useAgentName";
import { requestBrowserWarmup } from "@/lib/voice/warmBrowser";

const fieldClass =
  "border border-line3 rounded-[10px] px-[14px] py-3 text-[15px] bg-white transition-colors focus:border-brand focus:shadow-[0_0_0_3px_#eef0ff]";

export default function PreCallForm({ vals }: { vals: DemoVals }) {
  const agentName = useAgentName();
  // Warm up the cloud browser while the visitor fills the form, so the room
  // opens faster. No-op unless NEXT_PUBLIC_VOICE_PREWARM=1.
  useEffect(() => {
    requestBrowserWarmup();
  }, []);
  return (
    <div className="min-h-screen grid grid-cols-[0.85fr_1fr]">
      {/* Left dark panel */}
      <div className="bg-night text-white p-12 flex flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-white flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-brand" />
          </div>
          <span className="font-extrabold text-[19px] tracking-[-.02em]">
            Demoless
          </span>
        </div>

        <div>
          <div className="flex items-center gap-[14px] mb-[26px]">
            <div className="relative w-16 h-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-coalline bg-coal text-2xl font-bold text-white">
                {agentName.charAt(0)}
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-live border-[3px] border-night" />
            </div>
            <div>
              <div className="text-[18px] font-bold">{agentName}</div>
              <div className="text-[14px] text-faint font-mono">
                AI Product Specialist
              </div>
            </div>
          </div>

          <h2 className="text-[28px] font-extrabold tracking-[-.025em] leading-[1.15] m-0 mb-7 max-w-[360px]">
            A few quick details so I know who is joining.
          </h2>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-brand text-[18px]">●</span>
              <span className="text-[15px] text-stone300">
                Live in ~3 minutes, voice-led, screen-shared
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-brand text-[18px]">●</span>
              <span className="text-[15px] text-stone300">
                Skip ahead or ask anything, anytime
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-brand text-[18px]">●</span>
              <span className="text-[15px] text-stone300">
                No human joins unless you ask for one
              </span>
            </div>
          </div>
        </div>

        <div className="text-[13px] text-muted2">
          SOC 2 Type II · your inputs are never shared
        </div>
      </div>

      {/* Right form panel */}
      <div className="px-14 py-12 flex flex-col justify-center max-w-[560px]">
        <button
          onClick={vals.goLanding}
          className="self-start bg-none border-none text-muted2 text-[14px] font-semibold cursor-pointer mb-7 p-0"
        >
          ← Back
        </button>
        <h1 className="text-[30px] font-extrabold tracking-[-.025em] m-0 mb-1.5">
          Join your AI demo
        </h1>
        <p className="text-[16px] text-muted2 m-0 mb-[30px]">
          Step into the call, {agentName} is ready when you are.
        </p>

        <div className="grid grid-cols-2 gap-y-4 gap-x-[18px]">
          <label className="col-span-1 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Your name
            </span>
            <input
              type="text"
              value={vals.form.name}
              onChange={vals.onName}
              placeholder="Alex"
              className={fieldClass}
            />
          </label>
          <label className="col-span-1 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Work email
            </span>
            <input
              type="email"
              value={vals.form.email}
              onChange={vals.onEmail}
              placeholder="alex@company.com"
              className={fieldClass}
            />
          </label>
        </div>

        <button
          onClick={vals.startDemo}
          className="mt-[26px] flex cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border-none bg-brand p-4 text-[17px] font-bold text-white transition-colors hover:bg-branddeep"
        >
          <span
            className="w-[9px] h-[9px] rounded-full bg-white"
            style={{ animation: "dlBlink 1.4s infinite" }}
          />
          Join AI Demo
        </button>
        <p className="text-center text-[13px] text-faint mt-3.5 mb-0">
          By joining you agree to be recorded for quality. No spam, ever.
        </p>
      </div>
    </div>
  );
}
