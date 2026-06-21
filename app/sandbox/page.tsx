"use client";

import { useState } from "react";

interface Screen {
  sessionId: string;
  url: string;
  title: string;
}

export default function SandboxPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [busy, setBusy] = useState(false);
  const [navUrl, setNavUrl] = useState("https://www.browserbase.com/");
  const [clickStr, setClickStr] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const push = (m: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 40));

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const r = await fetch("/api/browser", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, sessionId, ...extra }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "request failed");
      return data;
    } catch (e) {
      push(`error: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const d = await call("start", { url: navUrl });
    if (!d) return;
    setSessionId(d.sessionId);
    setLiveViewUrl(d.liveViewUrl);
    setScreen({ sessionId: d.sessionId, url: d.url, title: d.title });
    push(`started ${d.sessionId.slice(0, 8)}… → ${d.title || d.url}`);
  }
  async function go() {
    const d = await call("navigate", { url: navUrl });
    if (!d) return;
    setScreen(d);
    push(`navigate → ${d.title || d.url}`);
  }
  async function click() {
    if (!clickStr.trim()) return;
    const d = await call("click", { text: clickStr });
    if (!d) return;
    setScreen(d);
    push(`click "${clickStr}" → ${d.title || d.url}`);
  }
  async function stop() {
    await call("stop");
    push("session stopped");
    setSessionId(null);
    setLiveViewUrl(null);
    setScreen(null);
  }

  return (
    <div className="min-h-screen bg-night text-white flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-coalline">
        <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-brand" />
        </div>
        <span className="font-bold">Demoless · Browser sandbox</span>
        <span className="font-mono text-xs text-faint2">
          {sessionId ? `session ${sessionId.slice(0, 8)}…` : "no session"}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-2 text-xs font-mono"
          style={{ color: sessionId ? "#22c55e" : "#8a8782" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: sessionId ? "#22c55e" : "#4b4b48" }}
          />
          {sessionId ? "LIVE" : "idle"}
        </span>
      </header>

      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Live product stream */}
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-coalline bg-black relative">
          {liveViewUrl ? (
            <iframe
              src={liveViewUrl}
              title="Live product"
              className="w-full h-full"
              sandbox="allow-same-origin allow-scripts allow-forms"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-faint2 text-sm">
              Start a session to stream the live product here.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-[320px] flex-none flex flex-col gap-3">
          <div className="rounded-xl border border-coalline bg-night2 p-4 flex flex-col gap-3">
            {!sessionId ? (
              <button
                onClick={start}
                disabled={busy}
                className="bg-brand text-white rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-50"
              >
                {busy ? "Starting…" : "▶ Start session"}
              </button>
            ) : (
              <button
                onClick={stop}
                disabled={busy}
                className="bg-danger text-white rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-50"
              >
                ⏹ Stop session
              </button>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-faint">navigate</span>
              <div className="flex gap-2">
                <input
                  value={navUrl}
                  onChange={(e) => setNavUrl(e.target.value)}
                  className="flex-1 min-w-0 bg-night3 border border-coalline rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="https://…"
                />
                <button
                  onClick={go}
                  disabled={busy || !sessionId}
                  className="bg-coal text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-40"
                >
                  Go
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-faint">
                click_or_type (by visible text)
              </span>
              <div className="flex gap-2">
                <input
                  value={clickStr}
                  onChange={(e) => setClickStr(e.target.value)}
                  className="flex-1 min-w-0 bg-night3 border border-coalline rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="e.g. Leaderboard"
                />
                <button
                  onClick={click}
                  disabled={busy || !sessionId}
                  className="bg-coal text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-40"
                >
                  Click
                </button>
              </div>
            </label>
          </div>

          {screen && (
            <div className="rounded-xl border border-coalline bg-night2 p-4 text-xs">
              <div className="font-mono text-faint2 mb-1">screen_is_on</div>
              <div className="text-white font-semibold truncate">
                {screen.title || "(untitled)"}
              </div>
              <div className="text-faint truncate">{screen.url}</div>
            </div>
          )}

          <div className="rounded-xl border border-coalline bg-night2 p-4 flex-1 min-h-0 overflow-auto">
            <div className="font-mono text-faint2 text-xs mb-2">log</div>
            <div className="flex flex-col gap-1">
              {log.map((line, i) => (
                <div key={i} className="text-[11px] font-mono text-stone350">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
