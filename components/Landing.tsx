"use client";

import Link from "next/link";
import type { DemoVals } from "@/lib/types";

// Primary CTA — on our cobalt brand, with a subtle depth gradient.
const launchGradient = {
  backgroundImage:
    "radial-gradient(120% 140% at 78% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 55%)," +
    "linear-gradient(100deg, #3A41D6 0%, #2A2FA8 100%)",
};

function LaunchButton({
  onClick,
  large = false,
}: {
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={launchGradient}
      className={
        "group inline-flex cursor-pointer items-center gap-2 rounded-[14px] border-none font-semibold text-white shadow-[0_1px_2px_rgba(14,17,22,.08),0_12px_26px_-10px_rgba(58,65,214,.6)] transition-transform hover:scale-[1.015] " +
        (large ? "px-7 py-4 text-[17px]" : "px-[20px] py-[11px] text-[15px]")
      }
    >
      Launch Demo Now
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="transition-transform group-hover:translate-x-0.5"
        aria-hidden
      >
        <path
          d="M6 3.5 10.5 8 6 12.5"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// Illustrative live-intent activity — the product's core value made visible.
const INTERESTED: [string, string, string][] = [
  ["VP Eng · Cadence Labs", "Brazil", "9:54 PM"],
  ["Founder · Verite", "Germany", "6:09 PM"],
  ["Staff Eng · Northwind", "Mid-market", "3:48 PM"],
  ["Data Analyst · Unisoniq", "Freelancer", "3:02 AM"],
  ["CTO · Viralynx", "Small business", "2:21 AM"],
  ["PM · Lumenflow", "Enterprise", "1:57 AM"],
  ["Founder · Deepmatter", "Startup", "10:16 PM"],
];

const STARTED: [string, string, string][] = [
  ["Data Analyst · Unisoniq", "Australia", "3:02 AM"],
  ["PM · Deepmatter", "Germany", "6:09 PM"],
  ["PM · Lumenflow", "USA", "1:57 AM"],
  ["Founder · Deepmatter", "Portugal", "10:16 PM"],
  ["CFO · Nexusphere", "Brazil", "9:54 PM"],
];

function FeedCard({
  who,
  where,
  time,
  live,
}: {
  who: string;
  where: string;
  time: string;
  live?: boolean;
}) {
  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-2 rounded-[12px] border border-edge bg-slate p-4">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-[7px] w-[7px] rounded-full " + (live ? "bg-livelit" : "bg-brandlit")
          }
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ember">
          {where}
        </span>
        <span className="ml-auto font-mono text-[11px] text-ember">{time}</span>
      </div>
      <span className="text-[14px] font-semibold text-chalk">{who}</span>
      <span className="text-[12px] text-ash">
        {live ? "Started a demo" : "Requested a demo"}
      </span>
    </div>
  );
}

const FEATURES: [string, string, string][] = [
  [
    "Available 24/7",
    "Always on",
    "Visitors jump into a live, narrated call straight from your landing page, in-app, or an outbound email — no scheduling, ever.",
  ],
  [
    "Hyper-personalized",
    "Adaptive",
    "Each demo adapts to the visitor's role and context, and stays current with your real product — not a recorded walkthrough.",
  ],
  [
    "Speaks their language",
    "Multilingual",
    "English, Spanish, and Mandarin. The agent meets your buyer where they are.",
  ],
  [
    "Insights backed by the transcript",
    "Signal",
    "After every call your dashboard gets why they came, their pain points, buying signals, and objections — each one backed by a real quote from the demo.",
  ],
];

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
        <div className="flex items-center gap-4">
          {vals.isAuthed ? (
            <span className="hidden text-[14px] font-medium text-ash sm:inline">
              {vals.authName ?? vals.authEmail}
            </span>
          ) : (
            <button
              onClick={vals.signInGoogle}
              className="hidden cursor-pointer border-none bg-transparent p-0 text-[14px] font-semibold text-chalk sm:inline"
            >
              Sign in
            </button>
          )}
          <LaunchButton onClick={vals.goForm} />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-14 px-10 pb-14 pt-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="m-0 max-w-[600px] font-serif text-[clamp(40px,5.2vw,60px)] font-medium leading-[1.04] tracking-[-0.02em] text-chalk">
            Don't make your prospects{" "}
            <em className="italic text-brandlit2">wait — ever again.</em>
          </h1>
          <p className="mb-9 mt-6 max-w-[470px] text-[18px] leading-[1.55] text-ash">
            An AI sales agent walks each visitor through your real product on a live call, answers
            out loud, and hands your team a scored read on what they cared about — the moment the
            call ends.
          </p>
          <div className="flex items-center gap-3">
            <LaunchButton onClick={vals.goForm} large />
            <Link
              href="/dashboard"
              className="rounded-[10px] border border-edge bg-slate px-[20px] py-[14px] text-[16px] font-semibold text-chalk transition-colors hover:border-ember"
            >
              See the dashboard →
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ember">
            <span>On-demand demos</span>
            <span className="text-edge">·</span>
            <span>Multi-language</span>
            <span className="text-edge">·</span>
            <span>Scored leads</span>
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

      {/* Live intent — the signature middle band, a moving feed of demand */}
      <section className="border-y border-edge bg-slate2/40 py-16">
        <div className="mx-auto w-full max-w-[1180px] px-10">
          <h2 className="m-0 max-w-[680px] font-serif text-[clamp(26px,3.4vw,36px)] font-medium leading-[1.12] tracking-[-0.015em] text-chalk">
            Close leads when intent is highest — with demos running around the clock.
          </h2>
        </div>
        <div className="mt-9 flex flex-col gap-3 overflow-hidden">
          <div className="marquee flex w-max gap-3 pl-3">
            {[...INTERESTED, ...INTERESTED].map((c, i) => (
              <FeedCard key={"i" + i} who={c[0]} where={c[1]} time={c[2]} />
            ))}
          </div>
          <div className="marquee marquee-rev flex w-max gap-3 pl-3">
            {[...STARTED, ...STARTED].map((c, i) => (
              <FeedCard key={"s" + i} who={c[0]} where={c[1]} time={c[2]} live />
            ))}
          </div>
        </div>
      </section>

      {/* Section header */}
      <section className="mx-auto w-full max-w-[1180px] px-10 pt-20 pb-4 text-center">
        <p className="m-0 font-mono text-[12px] uppercase tracking-[0.12em] text-ember">
          What a Demoless agent does for you
        </p>
        <h2 className="mx-auto mt-3 max-w-[640px] font-serif text-[clamp(30px,4vw,44px)] font-medium leading-[1.08] tracking-[-0.02em] text-chalk">
          Don't demo like it's 1995.
        </h2>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-[1180px] px-10 pb-16 pt-8">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-edge bg-edge sm:grid-cols-2">
          {FEATURES.map(([h, tag, p]) => (
            <div key={h} className="bg-slate p-8">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-brandlit">
                {tag}
              </div>
              <h3 className="mb-2 mt-3 text-[19px] font-bold tracking-[-0.01em] text-chalk">{h}</h3>
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
          <LaunchButton onClick={vals.goForm} large />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-obsidian">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-6 px-10 py-10">
          <div className="flex items-center gap-[10px]">
            <span className="flex h-[24px] w-[24px] items-center justify-center rounded-[7px] bg-brandlit">
              <span className="h-[8px] w-[8px] rounded-full bg-white" />
            </span>
            <span className="font-serif text-[16px] font-semibold tracking-[-0.01em] text-chalk">
              Demoless
            </span>
          </div>
          <p className="m-0 text-[13px] text-ash">
            Every prospect gets a live demo. Every demo becomes a scored lead.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-[13px] font-medium text-ash hover:text-chalk">
              Dashboard
            </Link>
            <button
              onClick={vals.goForm}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-ash hover:text-chalk"
            >
              Launch demo
            </button>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .marquee {
          animation: marquee 38s linear infinite;
        }
        .marquee-rev {
          animation-direction: reverse;
          animation-duration: 46s;
        }
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
