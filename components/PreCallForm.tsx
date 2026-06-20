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

        {/* Identity — verified via Google, not typed. */}
        {vals.isAuthed ? (
          <div className="flex items-center justify-between gap-3 border border-line3 rounded-[10px] px-[14px] py-3 bg-white mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-coal to-brand flex items-center justify-center text-white text-[15px] font-bold">
                {(vals.authName || vals.authEmail || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink2 truncate">
                  {vals.authName || "Signed in"}{" "}
                  <span className="text-live">✓</span>
                </div>
                <div className="text-[13px] text-muted2 truncate">
                  {vals.authEmail}
                </div>
              </div>
            </div>
            <button
              onClick={vals.signOutGoogle}
              className="shrink-0 bg-none border-none text-muted2 text-[13px] font-semibold cursor-pointer p-0"
            >
              Switch account
            </button>
          </div>
        ) : (
          <button
            onClick={vals.signInGoogle}
            disabled={vals.authStatus === "loading"}
            className="flex items-center justify-center gap-3 border border-line3 rounded-[10px] px-[14px] py-3 bg-white text-[15px] font-semibold text-ink2 cursor-pointer transition-colors hover:border-brand mb-5 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
              />
            </svg>
            Continue with Google
          </button>
        )}

        <div className="grid grid-cols-2 gap-y-4 gap-x-[18px]">
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
          disabled={!vals.canStart}
          className="mt-[26px] bg-brand text-white border-none p-4 rounded-xl text-[17px] font-bold cursor-pointer shadow-[0_4px_16px_rgba(79,70,229,.3)] flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <span
            className="w-[9px] h-[9px] rounded-full bg-white"
            style={{ animation: "dlBlink 1.4s infinite" }}
          />
          Join AI Demo
        </button>
        <p className="text-center text-[13px] text-faint mt-3.5 mb-0">
          {vals.canStart
            ? "By joining you agree to be recorded for quality. No spam, ever."
            : "Sign in with Google to join your demo."}
        </p>
      </div>
    </div>
  );
}
