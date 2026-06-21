"use client";

import { useEffect, useRef, useState } from "react";
import { useHarness } from "@/lib/harness/useHarness";
import type { Note } from "@/shared/contract";
import TracePane from "./TracePane";

const STATUS_COLOR: Record<string, string> = {
  open: "bg-live",
  connecting: "bg-warn",
  closed: "bg-faint",
  error: "bg-danger",
};

const NOTE_COLOR: Record<Note["type"], string> = {
  objection: "bg-warnsoft text-warn",
  interest: "bg-goodsoft text-good",
  role: "bg-brandsoft text-branddeep",
  question: "bg-chip text-muted",
};

export default function Harness() {
  const h = useHarness();
  const [draft, setDraft] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [h.chat]);

  const submit = () => {
    h.send(draft);
    setDraft("");
  };

  const snap = h.snapshot;
  const notes = snap?.buyer?.notes ?? [];

  return (
    <main className="dl-page flex h-screen flex-col bg-paper text-ink">
      {/* Header / controls */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-night px-4 py-2.5 text-white">
        <span className="font-700">Demoless</span>
        <span className="font-mono text-[11px] text-nav">chat harness</span>

        <div className="ml-2 flex items-center gap-1 rounded-md bg-night3 p-0.5">
          {(["mock", "live"] as const).map((m) => (
            <button
              key={m}
              onClick={() => h.setMode(m)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] uppercase ${
                h.mode === m ? "bg-brand text-white" : "text-nav hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[h.status]}`} />
          <span className="font-mono text-[11px] text-nav">{h.status}</span>
        </div>

        {h.mode === "live" && (
          <input
            value={h.url}
            onChange={(e) => h.setUrl(e.target.value)}
            className="w-52 rounded bg-night3 px-2 py-1 font-mono text-[11px] text-white placeholder:text-dim"
            placeholder="ws://localhost:8787"
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          <input
            value={h.buyerId}
            onChange={(e) => h.setBuyerId(e.target.value)}
            className="w-36 rounded bg-night3 px-2 py-1 font-mono text-[11px] text-white placeholder:text-dim"
            placeholder="buyer id"
          />
          <button
            onClick={h.start}
            className="rounded bg-brand px-3 py-1 text-[12px] font-600 hover:bg-branddeep"
          >
            Start run
          </button>
          <button
            onClick={() => h.reset(false)}
            className="rounded border border-coalline px-3 py-1 text-[12px] text-nav hover:text-white"
          >
            New run
          </button>
          <button
            onClick={() => h.reset(true)}
            className="rounded border border-coalline px-3 py-1 text-[12px] text-nav hover:text-danger"
          >
            Wipe buyer
          </button>
        </div>
      </header>

      {/* State strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line bg-wash px-4 py-2">
        <Field label="phase" value={snap?.phase ?? "—"} mono />
        <Field
          label="tour"
          value={snap?.currentStep ? `#${snap.tourIndex ?? "?"} ${snap.currentStep}` : "—"}
          mono
        />
        <Field label="buyer" value={snap?.buyer?.name ?? snap?.buyer?.id ?? "—"} />
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">notes</span>
          {notes.length === 0 ? (
            <span className="text-[12px] text-faint">none yet</span>
          ) : (
            notes.map((n, i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-0.5 text-[11px] font-500 ${NOTE_COLOR[n.type]}`}
                title={`${n.type} · ${n.at}`}
              >
                {n.type}: {n.value}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Body: chat + trace */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
        {/* Chat */}
        <section className="flex min-h-0 flex-col border-r border-line">
          <div className="dl-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {h.chat.length === 0 ? (
              <p className="mt-8 text-center text-[13px] text-faint">
                Type below to send <span className="font-mono">user_said</span>, or hit{" "}
                <span className="font-mono">Start run</span> to fire{" "}
                <span className="font-mono">buyer_loaded</span>.
              </p>
            ) : (
              h.chat.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${
                      m.role === "user"
                        ? "bg-brand text-white"
                        : "border border-line bg-white text-ink"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEnd} />
          </div>

          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Message the agent…"
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[14px] placeholder:text-faint focus:border-brand"
            />
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-[14px] font-600 text-white hover:bg-branddeep disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </section>

        {/* Trace */}
        <aside className="min-h-0 bg-wash4">
          <TracePane trace={h.trace} />
        </aside>
      </div>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-faint">{label}</span>
      <span className={`text-[12px] font-600 text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
