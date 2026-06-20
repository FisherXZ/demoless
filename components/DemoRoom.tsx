"use client";

import { useState, useRef, useEffect } from "react";
import type { DemoVals } from "@/lib/types";
import { useVoiceAgent } from "@/lib/voice/useVoiceAgent";
import { useAgentName } from "@/lib/voice/useAgentName";
import { LANGUAGES, type Language } from "@/lib/voice/messages";

const TARGET = "https://worldcuparena.live/";

const SUGGESTIONS = [
  "Show me the leaderboard",
  "Open the blog",
  "What is this benchmark?",
];

const GREETING =
  "Hi! I'm Maya. This is WorldCup Arena, a live AI-model trading benchmark. Ask me to show you anything, the leaderboard, the agents, how it works.";

// Mirrors the server fast path so the chat can answer instantly for obvious
// sections while the browser catches up.
const SECTION_WORDS: { label: string; words: string[] }[] = [
  { label: "Leaderboard", words: ["leaderboard", "rankings", "ranking", "standings", "board"] },
  { label: "Agents", words: ["agents", "agent", "models", "model", "bots", "players", "competitors"] },
  { label: "Matches", words: ["matches", "match", "games", "head to head", "head-to-head"] },
  { label: "Blog", words: ["blog", "posts", "articles", "article", "news", "writeup"] },
  { label: "About", words: ["about", "info", "story", "who made"] },
  { label: "Live", words: ["live", "home", "homepage", "dashboard", "chart", "overview"] },
];
const QUESTION_STARTS = [
  "what", "which", "how", "why", "who", "where", "when",
  "is ", "are ", "do ", "does ", "can ", "could ", "would ", "should ",
  "tell me", "explain",
];
function isQuestion(message: string): boolean {
  const m = message.trim().toLowerCase();
  return m.includes("?") || QUESTION_STARTS.some((q) => m.startsWith(q));
}
function matchSection(message: string): string | null {
  if (isQuestion(message)) return null; // questions get a real answer from Claude
  const m = message.toLowerCase();
  for (const s of SECTION_WORDS) if (s.words.some((w) => m.includes(w))) return s.label;
  return null;
}

function statusLabel(status: string, name: string): string {
  switch (status) {
    case "idle":
      return "Tap the mic to talk";
    case "connecting":
      return "Connecting...";
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking...";
    case "speaking":
      return `${name} is speaking`;
    case "error":
      return "Voice unavailable";
    default:
      return status;
  }
}

interface ChatMsg {
  role: "maya" | "you";
  text: string;
}

export default function DemoRoom({ vals }: { vals: DemoVals }) {
  const voice = useVoiceAgent();
  const configuredName = useAgentName();

  // Browser-share session state (Maya drives a real cloud browser).
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [screen, setScreen] = useState<{ url: string; title: string } | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [caption, setCaption] = useState(GREETING);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent name follows the selected voice model; fall back to "Maya" before a
  // voice session reports its name.
  const agentName = voice.active && voice.agentName ? voice.agentName : "Maya";

  // The rep tile pulses while Maya speaks (voice) or is navigating (text chat).
  const mayaSpeaking = voice.active ? voice.agentSpeaking : sending;

  // Captions: prefer real spoken text once the voice loop is running. Swap any
  // "Maya" in the mock caption for the configured name so it stays consistent.
  const rawCaption = voice.active && voice.lastCaption ? voice.lastCaption : vals.caption;
  const mayaCaption = rawCaption.replace(/Maya/g, agentName);

  const otherLang: Language = voice.language === "en" ? "es" : "en";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function start() {
    setConnecting(true);
    setError(null);
    try {
      const r = await fetch("/api/browser", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", url: TARGET }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "failed to start");
      setSessionId(d.sessionId);
      setLiveViewUrl(d.liveViewUrl);
      setScreen({ url: d.url, title: d.title });
      setMessages([{ role: "maya", text: GREETING }]);
      setCaption(GREETING);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || !sessionId || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "you", text: msg }]);

    // Optimistic: for an obvious section, show Maya's reply immediately so the
    // chat feels live; the browser navigation lands a beat later.
    const optimistic = matchSection(msg);
    if (optimistic) {
      const line = `Sure, here's ${optimistic.toLowerCase()}.`;
      setMessages((m) => [...m, { role: "maya", text: line }]);
      setCaption(line);
    }

    setSending(true);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: msg }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "agent failed");
      if (!optimistic) {
        setMessages((m) => [...m, { role: "maya", text: d.reply }]);
        setCaption(d.reply);
      }
      if (d.url) setScreen({ url: d.url, title: d.title });
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: "maya", text: `(error: ${text})` }]);
    } finally {
      setSending(false);
    }
  }

  async function end() {
    if (voice.active) voice.stop();
    if (sessionId) {
      await fetch("/api/browser", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId }),
      }).catch(() => {});
    }
    vals.goDashboard();
  }

  return (
    <div className="h-screen bg-night flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 flex-none">
        <div className="flex items-center gap-[14px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-brand" />
            </div>
            <span className="text-white font-bold text-[15px]">
              Demoless live demo
            </span>
          </div>
          {voice.active && (
            <div className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full bg-night3 border border-coalline">
              <span
                className="w-1.5 h-1.5 rounded-full bg-live"
                style={
                  voice.status === "listening"
                    ? { animation: "dlSpeak 1.3s infinite" }
                    : undefined
                }
              />
              <span className="text-xs text-stone350 font-mono">
                {statusLabel(voice.status, agentName)}
              </span>
            </div>
          )}
          <div className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full bg-night3 border border-coalline">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            <span className="text-xs text-stone350 font-mono">
              Tailored for {vals.tailoredFor}
            </span>
          </div>
        </div>
        <span className="text-[13px] text-faint2 font-mono inline-flex items-center gap-1.5">
          <span
            className="w-[7px] h-[7px] rounded-full bg-danger"
            style={{ animation: "dlBlink 1.4s infinite" }}
          />
          {sessionId ? "LIVE" : "offline"}
        </span>
      </div>

      {/* Stage */}
      <div className="flex-1 flex gap-3.5 px-5 pb-3.5 min-h-0">
        {/* Product share — the real cloud browser Maya drives */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 relative bg-white rounded-[14px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-coal min-h-0">
            <div className="h-11 border-b border-hair flex items-center gap-3.5 px-4 flex-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0efed]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0efed]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0efed]" />
              </div>
              <div className="flex-1 min-w-0 h-7 rounded-md bg-wash2 flex items-center px-3">
                <span className="text-xs text-muted2 truncate">
                  {screen?.url || TARGET}
                </span>
              </div>
              <span className="text-[11px] text-faint font-mono truncate max-w-[200px]">
                {screen?.title || ""}
              </span>
            </div>

            <div className="absolute top-11 left-0 right-0 bottom-0 bg-night">
              {liveViewUrl ? (
                <iframe
                  src={liveViewUrl}
                  title="WorldCup Arena (live)"
                  className="w-full h-full"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  allow="clipboard-read; clipboard-write"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="text-stone350 text-sm">
                    {connecting
                      ? "Connecting to the live product…"
                      : "Maya is ready to walk you through WorldCup Arena."}
                  </div>
                  {!connecting && (
                    <button
                      onClick={start}
                      className="bg-brand text-white rounded-xl px-6 py-3.5 text-base font-bold inline-flex items-center gap-2.5 shadow-[0_4px_16px_rgba(79,70,229,0.3)]"
                    >
                      <span
                        className="w-[9px] h-[9px] rounded-full bg-white"
                        style={{ animation: "dlBlink 1.4s infinite" }}
                      />
                      Start live demo
                    </button>
                  )}
                  {connecting && (
                    <div
                      className="w-8 h-8 rounded-full border-2 border-coalline border-t-brand"
                      style={{ animation: "dlBlink 1s infinite" }}
                    />
                  )}
                  {error && (
                    <div className="text-danger text-xs font-mono max-w-[420px] text-center">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Maya avatar tile */}
            <div className="absolute right-3.5 bottom-3.5 w-[168px] h-[116px] rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.4)] border-2 border-brand bg-gradient-to-br from-coal to-brand">
              <div className="absolute inset-0 flex items-center justify-center text-white/90 text-3xl font-bold">
                {agentName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_-40px_30px_-20px_rgba(0,0,0,0.5)]" />
              <div className="absolute left-2 bottom-[7px] flex items-center gap-1.5 pointer-events-none">
                <span className="relative w-[9px] h-[9px]">
                  <span className="absolute inset-0 rounded-full bg-live" />
                  {mayaSpeaking && (
                    <span
                      className="absolute -inset-1 rounded-full bg-live"
                      style={{ animation: "dlSpeak 1.3s infinite" }}
                    />
                  )}
                </span>
                <span className="text-[11px] text-white font-semibold">{agentName}</span>
                <span className="text-[9px] text-stone350 bg-black/40 px-[5px] py-px rounded font-mono">
                  AI
                </span>
              </div>
            </div>

            {/* captions */}
            {vals.captionsOn && (
              <div className="absolute left-3.5 bottom-3.5 max-w-[58%] flex flex-col gap-1.5">
                {voice.active && voice.partialTranscript && (
                  <div className="bg-brand/90 text-white px-[15px] py-[9px] rounded-[11px] text-sm leading-[1.4] self-start">
                    <span className="text-[#dcd6ff] font-bold text-xs font-mono">
                      YOU&nbsp;&nbsp;
                    </span>
                    {voice.partialTranscript}
                  </div>
                )}
                <div className="bg-night/90 text-white px-[15px] py-[11px] rounded-[11px] text-sm leading-[1.4]">
                  <span className="text-[#a5b4fc] font-bold text-xs font-mono">
                    {agentName.toUpperCase()}&nbsp;&nbsp;
                  </span>
                  {mayaCaption}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel — drive Maya by text (voice drives her in parallel) */}
        <div className="w-[330px] flex-none bg-night2 rounded-[14px] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-coalline flex-none">
            <div className="text-[11px] tracking-[0.1em] uppercase text-dim font-bold font-mono">
              Talk to {agentName}
            </div>
            <div className="text-[11px] text-faint2 mt-0.5">
              {sessionId ? "she drives the live product" : "start the demo to chat"}
            </div>
          </div>

          <div ref={scrollRef} className="dl-scroll flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "you"
                    ? "self-end max-w-[85%] bg-brand text-white rounded-[12px] rounded-br-[3px] px-3 py-2 text-[13px] leading-snug"
                    : "self-start max-w-[88%] bg-night3 text-stone350 rounded-[12px] rounded-bl-[3px] px-3 py-2 text-[13px] leading-snug border border-coalline"
                }
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="self-start text-faint2 text-[12px] font-mono px-1">
                {agentName} is navigating…
              </div>
            )}
            {sessionId && messages.length <= 1 && (
              <div className="flex flex-col gap-1.5 mt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-[12px] text-stone350 bg-night3 border border-coalline rounded-lg px-3 py-2 hover:border-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-coalline flex-none flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(input);
              }}
              disabled={!sessionId || sending}
              placeholder={sessionId ? "Ask Maya to show you…" : "Start the demo first"}
              className="flex-1 min-w-0 bg-night3 border border-coalline rounded-lg px-3 py-2 text-sm text-white placeholder:text-dim disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!sessionId || sending || !input.trim()}
              className="bg-brand text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-none flex items-center justify-center gap-3 px-5 pt-1 pb-[18px] relative">
        <button
          onClick={() => (voice.active ? voice.stop() : void voice.start())}
          title={voice.active ? `Stop talking to ${agentName}` : `Talk to ${agentName}`}
          className="w-[50px] h-[50px] rounded-full border-none cursor-pointer text-[19px] flex items-center justify-center"
          style={{ background: voice.active ? "#4f46e5" : "#dc2626", color: "#fff" }}
        >
          {voice.active ? "\u{1F399}" : "\u{1F507}"}
        </button>
        <button
          onClick={() => voice.setLanguage(otherLang)}
          title={`Switch to ${LANGUAGES[otherLang].label}`}
          className="h-[50px] px-4 rounded-[25px] border-none cursor-pointer bg-coal text-line text-[13px] font-bold flex items-center justify-center font-mono"
        >
          {voice.language.toUpperCase()}
        </button>
        <button
          onClick={vals.toggleCam}
          className="w-[50px] h-[50px] rounded-full border-none cursor-pointer text-[19px] flex items-center justify-center"
          style={{ background: vals.camBg, color: vals.camColor }}
        >
          {vals.camIcon}
        </button>
        <button
          onClick={vals.toggleCaptions}
          className="w-[50px] h-[50px] rounded-full border-none cursor-pointer text-[13px] font-extrabold flex items-center justify-center"
          style={{ background: vals.ccBg, color: vals.ccColor }}
        >
          CC
        </button>
        <button
          onClick={end}
          className="h-[50px] px-6 rounded-full border-none cursor-pointer bg-danger text-white text-[15px] font-bold flex items-center gap-2"
        >
          End call
        </button>
        <div className="absolute right-5 text-xs font-mono">
          {voice.error ? (
            <span className="text-danger">{voice.error}</span>
          ) : (
            <span className="text-dim">
              {voice.active
                ? statusLabel(voice.status, agentName)
                : sending
                  ? `${agentName} is navigating…`
                  : `${agentName} is presenting`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
