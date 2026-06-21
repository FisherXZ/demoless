"use client";

import Link from "next/link";
import type { DemoVals } from "@/lib/types";

export default function Landing({ vals }: { vals: DemoVals }) {
  return (
    <div className="flex min-h-screen flex-col bg-obsidian text-chalk">
      {/* Top nav */}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-10 py-5">
        <div className="flex items-center gap-[10px]">
          <span className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-brandlit">
            <span className="h-[10px] w-[10px] rounded-full bg-white" />
          </span>
          <span className="font-serif text-[20px] font-semibold tracking-[-0.01em]">Demoless</span>
        </div>
        <nav className="hidden items-center gap-8 md:flex">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ember">Product</span>
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ember">Pricing</span>
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ember">Docs</span>
        </nav>
        <div className="flex items-center gap-4">
          {vals.isAuthed ? (
            <>
              <span className="text-[14px] font-medium text-ash">
                {vals.authName ?? vals.authEmail}
              </span>
              <button
                onClick={vals.goForm}
                className="cursor-pointer rounded-[9px] border-none bg-brandlit px-[18px] py-[10px] text-[14px] font-semibold text-white transition-colors hover:bg-brandlit2"
              >
                Go to demo →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={vals.signInGoogle}
                className="cursor-pointer border-none bg-transparent text-[14px] font-semibold text-chalk p-0"
              >
                Sign in
              </button>
              <button
                onClick={vals.goForm}
                className="cursor-pointer rounded-[9px] border-none bg-brandlit px-[18px] py-[10px] text-[14px] font-semibold text-white transition-colors hover:bg-brandlit2"
              >
                Start a demo
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-14 px-10 pb-14 pt-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-edge bg-slate px-3 py-[6px]">
            <span className="h-[7px] w-[7px] rounded-full bg-livelit" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash">
              AI sales engineer · live 24/7
            </span>
          </div>
          <h1 className="m-0 max-w-[600px] font-serif text-[clamp(40px,5.2vw,60px)] font-medium leading-[1.04] tracking-[-0.02em] text-chalk">
            Every prospect gets a live demo. Every demo becomes a{" "}
            <em className="italic text-brandlit2">scored lead.</em>
          </h1>
          <p className="mb-9 mt-6 max-w-[460px] text-[18px] leading-[1.55] text-ash">
            An AI engineer walks each visitor through your real product, answers out loud, and
            hands your team a scored read on what they cared about — the moment the call ends.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={vals.goForm}
              className="inline-flex cursor-pointer items-center gap-[9px] rounded-[10px] border-none bg-brandlit px-[24px] py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-brandlit2"
            >
              <span className="h-[8px] w-[8px] rounded-full bg-white" />
              Start a demo
            </button>
            <Link
              href="/dashboard"
              className="rounded-[10px] border border-edge bg-slate px-[20px] py-[14px] text-[16px] font-semibold text-chalk transition-colors hover:border-ember"
            >
              See the dashboard →
            </Link>
          </div>
        </div>

        {/* Hero visual — a flat still of the real dashboard */}
        <div className="rounded-[14px] border border-edge bg-slate p-[18px] shadow-[0_1px_2px_rgba(14,17,22,.04),0_12px_30px_rgba(14,17,22,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
              Pipeline · this week
            </span>
            <span className="font-mono text-[11px] text-ember">demoless.app</span>
          </div>
          <div className="grid grid-cols-3 gap-[10px]">
            {[
              ["Sessions", "127", "text-chalk"],
              ["Qualified", "54%", "text-brandlit2"],
              ["High intent", "22", "text-goodlit"],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-[10px] border border-edge p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ember">{l}</div>
                <div className={"mt-1.5 font-mono text-[22px] font-semibold " + c}>{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {[
              ["Cadence Labs", "VP Eng", "88", true],
              ["Verite", "Founder", "91", true],
              ["Northwind", "Staff Eng", "74", false],
            ].map(([co, role, score, q]) => (
              <div
                key={co as string}
                className="flex items-center gap-2.5 rounded-[9px] border border-edge2 px-3 py-2.5"
              >
                <span className="text-[13px] font-semibold text-chalk">{co}</span>
                <span className="text-[12px] text-ash">{role}</span>
                {q && (
                  <span className="rounded-[5px] bg-[#E6F4EA] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.05em] text-goodlit">
                    Qualified
                  </span>
                )}
                <span className="ml-auto font-mono text-[13px] font-bold text-goodlit">{score}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three steps — a real sequence, editorial numbering */}
      <section className="mx-auto w-full max-w-[1180px] px-10 py-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-edge bg-edge md:grid-cols-3">
          {[
            ["01", "Visitor clicks once", "No scheduling. They're inside a live, narrated demo of your real product within seconds."],
            ["02", "The agent shows & tells", "It drives the product, answers questions out loud, and reads the room as it goes."],
            ["03", "Your team gets the signal", "Intent, objections, and a recommended follow-up land in the dashboard the moment the call ends."],
          ].map(([n, h, p]) => (
            <div key={n} className="bg-slate p-7">
              <div className="font-mono text-[13px] font-bold text-brandlit">{n}</div>
              <h3 className="mb-2 mt-3 text-[18px] font-bold tracking-[-0.01em] text-chalk">{h}</h3>
              <p className="m-0 text-[15px] leading-[1.55] text-ash">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing band — layered dark element on the light page */}
      <section className="bg-chalk text-white">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-8 px-10 py-16">
          <h2 className="m-0 max-w-[560px] font-serif text-[clamp(28px,3.6vw,38px)] font-medium leading-[1.1] tracking-[-0.015em]">
            See it the way your buyers will. Take the demo yourself.
          </h2>
          <button
            onClick={vals.goForm}
            className="inline-flex cursor-pointer items-center gap-[9px] rounded-[11px] border-none bg-white px-7 py-4 text-[16px] font-semibold text-chalk transition-transform hover:scale-[1.02]"
          >
            <span className="h-[8px] w-[8px] rounded-full bg-brandlit" />
            Start a demo
          </button>
        </div>
      </section>
    </div>
  );
}
