"use client";

import { useState, useRef, useEffect } from "react";
import type { DemoVals } from "@/lib/types";
import { useVoiceAgent } from "@/lib/voice/useVoiceAgent";
import { useAgentName } from "@/lib/voice/useAgentName";
import { LANGUAGES, type Language } from "@/lib/voice/messages";

const TARGET = process.env.NEXT_PUBLIC_DEMO_TARGET_URL || "https://www.browserbase.com/";

const SUGGESTIONS = [
  "Show me my sessions",
  "Open the playground",
  "What is Browserbase?",
];


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
  role: "messi" | "you";
  text: string;
}

export default function DemoRoom({ vals }: { vals: DemoVals }) {
  const voice = useVoiceAgent({
    buyer: vals.buyerIdentity,
    language: vals.form.language,
  });
  useAgentName(); // side-effect: syncs agent name from server

  // Browser session state is now owned by the voice WS server — liveViewUrl
  // arrives via the live_view event; screen page comes via screen_is_on.
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent name follows the selected voice model; fall back to "Messi" before a
  // voice session reports its name.
  const agentName = voice.active && voice.agentName ? voice.agentName : "Messi";

  const agentSpeaking = voice.agentSpeaking;

  // Captions: prefer real spoken text once the voice loop is running. Swap any
  // default agent-name mentions in the caption for the configured name.
  const rawCaption = voice.lastCaption || vals.caption;
  const agentCaption = rawCaption.replace(/Messi/g, agentName);

  // Cycle through every configured language (EN -> ES -> 中文 -> EN).
  const langCodes = Object.keys(LANGUAGES) as Language[];
  const otherLang: Language =
    langCodes[(langCodes.indexOf(voice.language) + 1) % langCodes.length];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Auto-start the moment the room mounts: the visitor already clicked
  // "Join AI Demo", so the agent connects + greets immediately with no extra click.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void voice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(text: string) {
    const msg = text.trim();
    if (!msg || !voice.active) return;
    setInput("");
    setMessages((m) => [...m, { role: "you", text: msg }]);
    // Route text through the voice WS so the server brain handles it.
    voice.sendText(msg);
  }

  function end() {
    if (voice.active) voice.stop();
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
          {vals.recallLine && (
            <div className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full bg-brandsoft2 border border-brand max-w-[420px]">
              <span className="w-1.5 h-1.5 rounded-full bg-live flex-none" />
              <span className="text-xs text-[#c7d2fe] font-mono truncate">
                {vals.recallLine}
              </span>
            </div>
          )}
        </div>
        <span className="text-[13px] text-faint2 font-mono inline-flex items-center gap-1.5">
          <span
            className="w-[7px] h-[7px] rounded-full bg-danger"
            style={{ animation: "dlBlink 1.4s infinite" }}
          />
          {voice.liveViewUrl ? "LIVE" : "offline"}
        </span>
      </div>

      {/* Stage */}
      <div className="flex-1 flex gap-3.5 px-5 pb-3.5 min-h-0">
        {/* Product share — the real cloud browser the agent drives */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-[14px] border border-coal bg-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <div className="h-11 border-b border-hair flex items-center gap-3.5 px-4 flex-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0efed]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0efed]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0efed]" />
              </div>
              <div className="flex-1 min-w-0 h-7 rounded-md bg-wash2 flex items-center px-3">
                <span className="text-xs text-muted2 truncate">
                  {voice.lastScreen?.page || TARGET}
                </span>
              </div>
              <span className="text-[11px] text-faint font-mono truncate max-w-[200px]">
                {voice.lastScreen?.page || ""}
              </span>
            </div>

            <div className="absolute top-11 left-0 right-0 bottom-0 bg-night">
              {voice.liveViewUrl ? (
                <iframe
                  src={voice.liveViewUrl}
                  title="Browserbase (live)"
                  className="w-full h-full"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  allow="clipboard-read; clipboard-write"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="text-stone350 text-sm">
                    {voice.error
                      ? `${agentName} couldn't connect.`
                      : voice.status === "connecting"
                        ? `Connecting ${agentName} to the live product…`
                        : `${agentName} is ready to learn what you want to figure out.`}
                  </div>
                  {!voice.error && (
                    <div
                      className="w-8 h-8 rounded-full border-2 border-coalline border-t-brand"
                      style={{ animation: "dlBlink 1s infinite" }}
                    />
                  )}
                  {/* Auto-start handles the happy path; this is only a retry. */}
                  {voice.error && (
                    <button
                      onClick={() => void voice.start()}
                      className="bg-brand text-white rounded-xl px-6 py-3.5 text-base font-bold inline-flex items-center gap-2.5 shadow-[0_4px_16px_rgba(79,70,229,0.3)]"
                    >
                      <span className="w-[9px] h-[9px] rounded-full bg-white" />
                      Retry
                    </button>
                  )}
                  {(error || voice.error) && (
                    <div className="text-danger text-xs font-mono max-w-[420px] text-center">
                      {error ?? voice.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Agent avatar tile */}
            <div className="absolute bottom-3.5 right-3.5 h-[116px] w-[168px] overflow-hidden rounded-[12px] border border-coalline bg-coal shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 flex items-center justify-center text-white/90 text-3xl font-bold">
                {agentName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_-40px_30px_-20px_rgba(0,0,0,0.5)]" />
              <div className="absolute left-2 bottom-[7px] flex items-center gap-1.5 pointer-events-none">
                <span className="relative w-[9px] h-[9px]">
                  <span className="absolute inset-0 rounded-full bg-live" />
                  {agentSpeaking && (
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
                  {agentCaption}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel — drive the agent by text (voice drives in parallel) */}
        <div className="w-[330px] flex-none bg-night2 rounded-[14px] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-coalline flex-none">
            <div className="text-[11px] tracking-[0.1em] uppercase text-dim font-bold font-mono">
              Talk to {agentName}
            </div>
            <div className="text-[11px] text-faint2 mt-0.5">
              {voice.active ? "she drives the live product" : "start the demo to chat"}
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
            {voice.active && voice.status === "thinking" && (
              <div className="self-start text-faint2 text-[12px] font-mono px-1">
                {agentName} is thinking…
              </div>
            )}
            {voice.active && messages.length <= 1 && (
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
              disabled={!voice.active}
              placeholder={voice.active ? `Ask ${agentName} to show you…` : "Start the demo first"}
              className="flex-1 min-w-0 bg-night3 border border-coalline rounded-lg px-3 py-2 text-sm text-white placeholder:text-dim disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!voice.active || !input.trim()}
              className="bg-brand text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Controls — lifted above the fixed PROTOTYPE nav (bottom-left) so it
          can't cover the mic / language buttons. */}
      <div className="flex-none flex items-center justify-center gap-3 px-5 pt-1 pb-[18px] mb-14 relative">
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
                : `${agentName} is presenting`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
