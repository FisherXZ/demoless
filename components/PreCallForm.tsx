"use client";

import type { DemoVals } from "@/lib/types";

const fieldClass =
  "border border-line3 rounded-[10px] px-[14px] py-3 text-[15px] bg-white transition-colors focus:border-brand focus:shadow-[0_0_0_3px_#eef0ff]";
const selectClass = `${fieldClass} appearance-none cursor-pointer`;

export default function PreCallForm({ vals }: { vals: DemoVals }) {
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-coal to-brand flex items-center justify-center text-white text-2xl font-bold">
                M
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-live border-[3px] border-night" />
            </div>
            <div>
              <div className="text-[18px] font-bold">Maya</div>
              <div className="text-[14px] text-faint font-mono">
                AI Product Specialist
              </div>
            </div>
          </div>

          <h2 className="text-[28px] font-extrabold tracking-[-.025em] leading-[1.15] m-0 mb-7 max-w-[360px]">
            A few quick details so I can tailor your walkthrough.
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
          Step into the call, Maya is ready when you are.
        </p>

        <div className="grid grid-cols-2 gap-y-4 gap-x-[18px]">
          <label className="col-span-1 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Full name
            </span>
            <input
              value={vals.form.name}
              onChange={vals.onName}
              placeholder="Jordan Lee"
              className={fieldClass}
            />
          </label>
          <label className="col-span-1 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Work email
            </span>
            <input
              value={vals.form.email}
              onChange={vals.onEmail}
              placeholder="jordan@company.com"
              className={fieldClass}
            />
          </label>
          <label className="col-span-1 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Your role
            </span>
            <select
              value={vals.form.role}
              onChange={vals.onRole}
              className={selectClass}
            >
              <option>VP of Sales</option>
              <option>Sales / RevOps</option>
              <option>Founder / CEO</option>
              <option>Marketing</option>
              <option>IT / Security</option>
              <option>Other</option>
            </select>
          </label>
          <label className="col-span-1 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Company size
            </span>
            <select
              value={vals.form.size}
              onChange={vals.onSize}
              className={selectClass}
            >
              <option>1–10</option>
              <option>11–50</option>
              <option>51–200</option>
              <option>201–1,000</option>
              <option>1,000+</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Primary use case
            </span>
            <select
              value={vals.form.useCase}
              onChange={vals.onUseCase}
              className={selectClass}
            >
              <option>Outbound sales</option>
              <option>Inbound / PLG conversion</option>
              <option>Partner &amp; channel demos</option>
              <option>Customer onboarding</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink2">
              Biggest pain point{" "}
              <span className="text-faint font-normal">
                - so Maya can speak to it
              </span>
            </span>
            <textarea
              value={vals.form.pain}
              onChange={vals.onPain}
              placeholder="Reps waste hours demoing leads who never convert…"
              rows={2}
              className={`${fieldClass} resize-none leading-[1.4]`}
            />
          </label>
        </div>

        <button
          onClick={vals.startDemo}
          className="mt-[26px] bg-brand text-white border-none p-4 rounded-xl text-[17px] font-bold cursor-pointer shadow-[0_4px_16px_rgba(79,70,229,.3)] flex items-center justify-center gap-2.5"
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
