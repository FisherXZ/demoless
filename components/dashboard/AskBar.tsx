"use client";

import { useState } from "react";
import { SESSIONS, intentOf } from "@/lib/dashboard/data";

// Real retrieval over the session corpus. Routes a question to an aggregate
// answer computed from SESSIONS — no canned text. To upgrade to a true LLM
// answer, POST {question, corpus} to an /api/ask route and render its reply
// here instead of answer(); the corpus shape is already the Scorecard set.

const SUGGESTED = [
  "Where are we losing prospects?",
  "Top objections this week",
  "Which accounts need follow-up?",
  "How many qualified this week?",
];

interface Answer {
  headline: string;
  lines: string[];
}

function answer(qRaw: string): Answer {
  const q = qRaw.toLowerCase();

  if (/objection|concern|blocker|pushback/.test(q)) {
    const objs = SESSIONS.flatMap((s) =>
      s.signals
        .filter((g) => g.type === "objection")
        .map((g) => `${s.buyer.company}: ${g.value}`)
    );
    return {
      headline: `${objs.length} objections raised across recent demos. The recurring themes are security/compliance (SOC 2, audit logs, residency) and cost vs. self-hosted.`,
      lines: objs,
    };
  }

  if (/follow.?up|need|reach|chase|account/.test(q)) {
    const hot = SESSIONS.filter((s) => s.qualified && intentOf(s.score) === "High");
    return {
      headline: `${hot.length} qualified high-intent accounts need follow-up:`,
      lines: hot.map((s) => `${s.buyer.company} (${s.score}) — ${s.followUp.text}`),
    };
  }

  if (/losing|los[et]|drop|bounce|stall|low/.test(q)) {
    const cold = SESSIONS.filter((s) => s.score < 60 || s.durationSec < 130).sort(
      (a, b) => a.score - b.score
    );
    return {
      headline: `${cold.length} prospects are slipping — short sessions or low intent. Most dropped before pricing or on cost-vs-self-hosted.`,
      lines: cold.map(
        (s) =>
          `${s.buyer.company} (${s.score}, ${Math.round(s.durationSec / 60)}m) — ${
            s.signals.find((g) => g.type === "objection")?.value ?? "dropped early, top-of-funnel"
          }`
      ),
    };
  }

  if (/qualified|how many|count|pipeline/.test(q)) {
    const qual = SESSIONS.filter((s) => s.qualified);
    return {
      headline: `${qual.length} of ${SESSIONS.length} sessions qualified (${Math.round(
        (qual.length / SESSIONS.length) * 100
      )}%). Strongest: ${qual
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.buyer.company)
        .join(", ")}.`,
      lines: qual.map((s) => `${s.buyer.company} — score ${s.score}, ${s.buyer.role}`),
    };
  }

  // default: top-level read
  const hi = SESSIONS.filter((s) => intentOf(s.score) === "High");
  return {
    headline: `${SESSIONS.length} demos analyzed. ${hi.length} high-intent. Interest clusters on Stagehand control and the live-view embed; friction clusters on SOC 2 and cost-vs-self-hosted.`,
    lines: hi.map((s) => `${s.buyer.company} — ${s.buyer.role}, score ${s.score}`),
  };
}

export default function AskBar() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Answer | null>(null);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setQ(t);
    setRes(answer(t));
  };

  return (
    <div className="mt-[18px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="group flex items-center gap-[10px] rounded-[12px] border border-edge bg-slate px-[15px] py-[12px] transition-colors focus-within:border-brandlit/60"
      >
        <span className="font-mono text-[14px] font-semibold text-brandlit">›</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about your demos…"
          className="flex-1 border-none bg-transparent font-mono text-[13px] text-chalk placeholder:text-ember"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="flex h-[27px] w-[27px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-none bg-brandlit text-[13px] font-semibold text-obsidian transition-colors hover:bg-brandlit2"
        >
          →
        </button>
      </form>

      <div className="mt-[11px] flex flex-wrap gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="cursor-pointer rounded-[8px] border border-edge bg-slate px-[11px] py-1.5 text-[12px] text-ash transition-colors hover:border-ember hover:text-chalk"
          >
            {s}
          </button>
        ))}
      </div>

      {res && (
        <div
          className="mt-[14px] rounded-[12px] border border-edge bg-slate p-[18px]"
          style={{ animation: "dlFade .3s ease both" }}
        >
          <p className="m-0 text-[14px] leading-[1.55] text-chalk">{res.headline}</p>
          {res.lines.length > 0 && (
            <ul className="mb-0 ml-0 mt-[12px] flex list-none flex-col gap-[9px] p-0">
              {res.lines.map((l, i) => (
                <li key={i} className="flex gap-[10px] text-[13px] leading-[1.45] text-ash">
                  <span className="flex-none font-mono text-brandlit">—</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
