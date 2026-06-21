"use client";

import Link from "next/link";
import type { DemoVals } from "@/lib/types";

export default function Landing({ vals }: { vals: DemoVals }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Top nav */}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-10 py-5">
        <div className="flex items-center gap-[10px]">
          <span className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] bg-ink">
            <span className="h-[11px] w-[11px] rounded-full bg-brand" />
          </span>
          <span className="text-[18px] font-extrabold tracking-[-0.02em]">Demoless</span>
        </div>
        <nav className="hidden items-center gap-8 md:flex">
          <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Product</span>
          <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Pricing</span>
          <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Docs</span>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-[14px] font-semibold text-ink">
            Dashboard
          </Link>
          <button
            onClick={vals.goForm}
            className="cursor-pointer rounded-[9px] border-none bg-brand px-[18px] py-[10px] text-[14px] font-semibold text-white"
          >
            Start a demo
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-14 px-10 pb-12 pt-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-[6px]">
            <span className="h-[7px] w-[7px] rounded-full bg-live" />
            <span className="font-mono text-[12px] tracking-[0.04em] text-muted">
              AI sales engineer · live 24/7
            </span>
          </div>
          <h1 className="m-0 max-w-[560px] text-[52px] font-extrabold leading-[1.05] tracking-[-0.035em]">
            Every prospect gets a live demo. Every demo becomes a scored lead.
          </h1>
          <p className="mb-8 mt-5 max-w-[460px] text-[18px] leading-[1.5] text-muted2">
            An AI engineer walks each visitor through your real product, answers out loud, and
            hands your team a scored read on what they cared about — the moment the call ends.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={vals.goForm}
              className="inline-flex cursor-pointer items-center gap-[9px] rounded-[11px] border-none bg-brand px-[24px] py-[14px] text-[16px] font-bold text-white"
            >
              <span className="h-[8px] w-[8px] rounded-full bg-white" />
              Start a demo
            </button>
            <Link
              href="/dashboard"
              className="rounded-[11px] border border-line bg-white px-[20px] py-[14px] text-[16px] font-semibold text-ink"
            >
              See the dashboard →
            </Link>
          </div>
        </div>

        {/* Hero visual — a flat still of the real dashboard (no glow/gradient) */}
        <div className="rounded-[14px] border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
              Pipeline · this week
            </span>
            <span className="font-mono text-[11px] text-faint">demoless.app</span>
          </div>
          <div className="grid grid-cols-3 gap-[10px]">
            {[
              ["Sessions", "127", "text-ink"],
              ["Qualified", "54%", "text-branddeep"],
              ["High intent", "22", "text-good"],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-[10px] border border-line p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">{l}</div>
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
                className="flex items-center gap-2.5 rounded-[9px] border border-line2 px-3 py-2.5"
              >
                <span className="text-[13px] font-semibold">{co}</span>
                <span className="text-[12px] text-muted2">{role}</span>
                {q && (
                  <span className="rounded-[5px] bg-goodsoft px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.04em] text-good">
                    Qualified
                  </span>
                )}
                <span className="ml-auto font-mono text-[13px] font-bold text-good">{score}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three steps — editorial, numbered (no icon-grid) */}
      <section className="mx-auto w-full max-w-[1180px] px-10 py-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-3">
          {[
            ["01", "Visitor clicks once", "No scheduling. They're inside a live, narrated demo of your real product within seconds."],
            ["02", "The agent shows & tells", "It drives the product, answers questions out loud, and reads the room as it goes."],
            ["03", "Your team gets the signal", "Intent, objections, and a recommended follow-up land in the dashboard the moment the call ends."],
          ].map(([n, h, p]) => (
            <div key={n} className="bg-paper p-7">
              <div className="font-mono text-[13px] font-bold text-brand">{n}</div>
              <h3 className="mb-2 mt-3 text-[18px] font-bold tracking-[-0.01em]">{h}</h3>
              <p className="m-0 text-[15px] leading-[1.5] text-muted2">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing band */}
      <section className="bg-night text-white">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-8 px-10 py-14">
          <h2 className="m-0 max-w-[540px] text-[32px] font-extrabold leading-[1.1] tracking-[-0.025em]">
            See it the way your buyers will. Take the demo yourself.
          </h2>
          <button
            onClick={vals.goForm}
            className="inline-flex cursor-pointer items-center gap-[9px] rounded-[12px] border-none bg-white px-7 py-4 text-[16px] font-bold text-ink"
          >
            <span className="h-[8px] w-[8px] rounded-full bg-brand" />
            Start a demo
          </button>
        </div>
      </section>
    </div>
  );
}
