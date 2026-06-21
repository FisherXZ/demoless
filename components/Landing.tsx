"use client";

import type { DemoVals } from "@/lib/types";

export default function Landing({ vals }: { vals: DemoVals }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between py-5 px-10 max-w-[1200px] mx-auto w-full">
        <div className="flex items-center gap-[10px]">
          <div className="w-[30px] h-[30px] rounded-lg bg-ink flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-brand" />
          </div>
          <span className="font-extrabold text-[19px] tracking-[-0.02em]">Demoless</span>
        </div>
        <nav className="flex items-center gap-[30px]">
          <span className="text-[15px] text-muted font-medium">Product</span>
          <span className="text-[15px] text-muted font-medium">Pricing</span>
          <span className="text-[15px] text-muted font-medium">Customers</span>
          <span className="text-[15px] text-muted font-medium">Docs</span>
        </nav>
        <div className="flex items-center gap-4">
          {vals.isAuthed ? (
            <>
              <span className="text-[14px] text-muted font-medium">
                {vals.authName ?? vals.authEmail}
              </span>
              <button
                onClick={vals.goForm}
                className="bg-brand text-white border-none py-[10px] px-[18px] rounded-[9px] text-[15px] font-semibold cursor-pointer shadow-[0_1px_2px_rgba(79,70,229,0.4)]"
              >
                Go to demo →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={vals.signInGoogle}
                className="bg-none border-none text-[15px] text-ink font-semibold cursor-pointer p-0"
              >
                Sign in
              </button>
              <button
                onClick={vals.goForm}
                className="bg-brand text-white border-none py-[10px] px-[18px] rounded-[9px] text-[15px] font-semibold cursor-pointer shadow-[0_1px_2px_rgba(79,70,229,0.4)]"
              >
                Start AI Demo
              </button>
            </>
          )}
        </div>
      </header>

      <section className="max-w-[1200px] mx-auto w-full pt-14 px-10 pb-10 grid grid-cols-2 gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 py-[6px] px-3 rounded-full bg-brandsoft mb-6">
            <span
              className="w-[7px] h-[7px] rounded-full bg-brand"
              style={{ animation: "dlBlink 1.6s infinite" }}
            />
            <span className="text-[13px] font-semibold text-branddeep font-mono">
              AI sales rep · live 24/7
            </span>
          </div>
          <h1 className="text-[54px] leading-[1.04] tracking-[-0.035em] font-extrabold m-0 mb-5 text-balance">
            The AI AE that sells your SaaS while your team sleeps.
          </h1>
          <p className="text-[19px] leading-[1.5] text-muted m-0 mb-8 max-w-[480px]">
            Visitors click once and join a live, Google Meet-style call. Your AI rep
            screen-shares the product and walks them through it by video voice interactive
            demo.{" "}
          </p>
          <div className="flex items-center gap-[14px]">
            <button
              onClick={vals.goForm}
              className="bg-brand text-white border-none py-[15px] px-[26px] rounded-[11px] text-[17px] font-bold cursor-pointer shadow-[0_4px_16px_rgba(79,70,229,0.32)] inline-flex items-center gap-[10px]"
            >
              <span className="w-[9px] h-[9px] rounded-full bg-white" />
              Start AI Demo
            </button>
            <button className="bg-white text-ink border border-line py-[15px] px-[22px] rounded-[11px] text-[17px] font-semibold cursor-pointer">
              Watch 60s ↗
            </button>
          </div>
          <div className="flex items-center gap-[10px] mt-7">
            <div className="flex">
              <span className="w-[26px] h-[26px] rounded-full bg-stone300 border-2 border-paper" />
              <span className="w-[26px] h-[26px] rounded-full bg-[#c7c3bf] border-2 border-paper -ml-2" />
              <span className="w-[26px] h-[26px] rounded-full bg-[#b8b3ae] border-2 border-paper -ml-2" />
            </div>
            <span className="text-[14px] text-muted2">
              4,200+ demos delivered this month · no rep required
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-[radial-gradient(120%_120%_at_70%_20%,#eef0ff_0%,rgba(238,240,255,0)_60%)] rounded-[28px]" />
          <div className="relative bg-night rounded-[18px] p-[14px] shadow-[0_24px_60px_rgba(28,28,26,0.22)] border border-coal">
            <div className="flex items-center gap-[7px] pt-1 px-[6px] pb-3">
              <span className="w-[9px] h-[9px] rounded-full bg-coal2" />
              <span className="w-[9px] h-[9px] rounded-full bg-coal2" />
              <span className="w-[9px] h-[9px] rounded-full bg-coal2" />
              <span className="ml-auto text-[11px] text-faint2 font-mono">● REC 01:12</span>
            </div>
            <div className="relative bg-white rounded-[11px] h-[260px] overflow-hidden">
              <div className="h-[34px] border-b border-hair flex items-center gap-2 px-3">
                <div className="w-4 h-4 rounded bg-ink" />
                <span className="text-[12px] font-bold">Demoless</span>
                <span className="ml-[10px] text-[11px] text-faint">Pricing</span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-[10px]">
                <div className="border border-hair rounded-[9px] p-3 h-[120px]" />
                <div
                  className="border-2 border-brand rounded-[9px] p-3 h-[120px] shadow-[0_0_0_4px_#eef0ff]"
                  style={{ animation: "dlRing 2s infinite" }}
                />
                <div className="border border-hair rounded-[9px] p-3 h-[120px]" />
              </div>
              <div className="absolute bottom-3 left-3 right-[90px] bg-[rgba(22,22,21,0.86)] text-white py-2 px-3 rounded-[9px] text-[12px] leading-[1.35]">
                “Pricing scales with demos, not seats, most teams your size land on Growth.”
              </div>
              <div className="absolute bottom-3 right-3 w-[72px] h-[52px] rounded-[9px] bg-coal border-2 border-brand overflow-hidden">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#3a3a37,#3a3a37_4px,#33332f_4px,#33332f_8px)]" />
                <span className="absolute bottom-[3px] left-1 text-[8px] text-stone350 font-mono">
                  Maya · AI
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-[10px] pt-3 pb-1">
              <span className="w-[30px] h-[30px] rounded-full bg-coal flex items-center justify-center text-stone350 text-[13px]">
                🎙
              </span>
              <span className="w-[30px] h-[30px] rounded-full bg-coal" />
              <span className="w-[44px] h-[30px] rounded-[16px] bg-danger" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto w-full pt-6 px-10 pb-2">
        <p className="text-[12px] tracking-[0.14em] uppercase text-faint font-semibold m-0 mb-[18px] font-mono">
          Replacing the demo queue at
        </p>
        <div className="flex items-center gap-11 flex-wrap opacity-55">
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Northwind</span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Cadence</span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Verite</span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Loop HQ</span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Mistral Labs</span>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto w-full pt-12 px-10 pb-16 grid grid-cols-3 gap-5">
        <div className="bg-white border border-line2 rounded-2xl p-[26px]">
          <div className="w-9 h-9 rounded-[10px] bg-brandsoft flex items-center justify-center mb-4">
            <div className="w-[14px] h-[14px] rounded bg-brand" />
          </div>
          <h3 className="text-[18px] font-bold m-0 mb-2 tracking-[-0.01em]">
            Instant, never scheduled
          </h3>
          <p className="text-[15px] leading-[1.5] text-muted2 m-0">
            No calendar back-and-forth. The buyer is inside the product within seconds of
            clicking.
          </p>
        </div>
        <div className="bg-white border border-line2 rounded-2xl p-[26px]">
          <div className="w-9 h-9 rounded-[10px] bg-brandsoft flex items-center justify-center mb-4">
            <div className="w-[14px] h-[14px] rounded-full bg-brand" />
          </div>
          <h3 className="text-[18px] font-bold m-0 mb-2 tracking-[-0.01em]">Tailored by role</h3>
          <p className="text-[15px] leading-[1.5] text-muted2 m-0">
            A VP of Sales and an IT lead see different paths, features, security, and ROI that
            match them.
          </p>
        </div>
        <div className="bg-white border border-line2 rounded-2xl p-[26px]">
          <div className="w-9 h-9 rounded-[10px] bg-brandsoft flex items-center justify-center mb-4">
            <div className="w-[14px] h-1 rounded-[2px] bg-brand" />
          </div>
          <h3 className="text-[18px] font-bold m-0 mb-2 tracking-[-0.01em]">Every call, scored</h3>
          <p className="text-[15px] leading-[1.5] text-muted2 m-0">
            Intent, objections, and a recommended follow-up land in your pipeline the moment the
            call ends.
          </p>
        </div>
      </section>

      <section className="bg-night text-white">
        <div className="max-w-[1200px] mx-auto py-14 px-10 flex items-center justify-between gap-8 flex-wrap">
          <h2 className="text-[34px] font-extrabold tracking-[-0.025em] m-0 max-w-[560px] leading-[1.1]">
            See it the way your buyers will. Take the AI demo yourself.
          </h2>
          <button
            onClick={vals.goForm}
            className="bg-white text-ink border-none py-4 px-7 rounded-[12px] text-[17px] font-bold cursor-pointer inline-flex items-center gap-[10px]"
          >
            <span className="w-[9px] h-[9px] rounded-full bg-brand" />
            Start AI Demo
          </button>
        </div>
      </section>
    </div>
  );
}
