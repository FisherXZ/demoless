"use client";

import type { DemoVals } from "@/lib/types";
import { useVoiceAgent } from "@/lib/voice/useVoiceAgent";
import { LANGUAGES, type Language } from "@/lib/voice/messages";

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

export default function DemoRoom({ vals }: { vals: DemoVals }) {
  const voice = useVoiceAgent();

  // Agent name follows the selected voice model; fall back to "Maya" for the
  // mock prototype state (before a voice session reports its name).
  const agentName = voice.active && voice.agentName ? voice.agentName : "Maya";

  // The rep is "live" whenever the voice loop is speaking; fall back to the mock
  // presenting state so the prototype still animates without a voice server.
  const mayaSpeaking = voice.active ? voice.agentSpeaking : !vals.paused;

  // Captions: prefer real spoken text once the voice loop is running.
  const mayaCaption = voice.active && voice.lastCaption ? voice.lastCaption : vals.caption;

  const otherLang: Language = voice.language === "en" ? "es" : "en";

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
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-faint2 font-mono inline-flex items-center gap-1.5">
            <span
              className="w-[7px] h-[7px] rounded-full bg-danger"
              style={{ animation: "dlBlink 1.4s infinite" }}
            />
            REC {vals.clock}
          </span>
        </div>
      </div>

      {/* Middle row */}
      <div className="flex-1 flex gap-[14px] px-5 pb-[14px] min-h-0">
        {/* Product-share panel */}
        <div className="flex-1 relative min-w-0 flex flex-col">
          <div className="flex-1 relative bg-white rounded-[14px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.35)] border border-coal min-h-0">
            {/* Browser chrome top bar */}
            <div className="h-11 border-b border-hair flex items-center gap-[14px] px-4 flex-none">
              <div className="flex items-center gap-2">
                <div className="w-[18px] h-[18px] rounded-[5px] bg-ink" />
                <span className="text-[13px] font-bold">Demoless</span>
              </div>
              <div className="flex items-center gap-1 ml-1.5">
                <span className="text-xs px-[9px] py-1 rounded-[7px] text-muted">
                  Home
                </span>
                <span className="text-xs px-[9px] py-1 rounded-[7px] text-muted">
                  Demos
                </span>
                <span className="text-xs px-[9px] py-1 rounded-[7px] text-muted">
                  Pipeline
                </span>
              </div>
              <div className="ml-auto inline-flex items-center gap-[7px] px-2.5 py-1 rounded-full bg-brandsoft">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span className="text-[11px] font-semibold text-branddeep font-mono">
                  {vals.shareLabel}
                </span>
              </div>
            </div>

            {/* Moment pages */}
            <div className="absolute top-11 left-0 right-0 bottom-0 overflow-hidden">
              {/* m0 — command center */}
              {vals.moment === 0 && (
                <div className="dl-page p-[22px] h-full">
                  <div className="flex items-end justify-between mb-[18px]">
                    <div>
                      <div className="text-[13px] text-faint">Good afternoon</div>
                      <div className="text-2xl font-extrabold tracking-[-.02em]">
                        Your demo command center
                      </div>
                    </div>
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-wash2 text-muted font-semibold">
                      This week
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="border border-hair rounded-xl p-4">
                      <div className="text-xs text-muted2 mb-2">AI demos run</div>
                      <div className="text-[28px] font-extrabold tracking-[-.02em]">
                        312
                      </div>
                      <div className="text-xs text-good font-semibold">▲ 28%</div>
                    </div>
                    <div className="border-2 border-brand rounded-xl p-4 shadow-[0_0_0_4px_#eef0ff]">
                      <div className="text-xs text-muted2 mb-2">
                        Avg lead score
                      </div>
                      <div className="text-[28px] font-extrabold tracking-[-.02em] text-branddeep">
                        74
                      </div>
                      <div className="text-xs text-good font-semibold">
                        ▲ 11 pts
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-4">
                      <div className="text-xs text-muted2 mb-2">Qualified</div>
                      <div className="text-[28px] font-extrabold tracking-[-.02em]">
                        128
                      </div>
                      <div className="text-xs text-good font-semibold">▲ 19%</div>
                    </div>
                    <div className="border border-hair rounded-xl p-4">
                      <div className="text-xs text-muted2 mb-2">
                        Rep-hours saved
                      </div>
                      <div className="text-[28px] font-extrabold tracking-[-.02em]">
                        96
                      </div>
                      <div className="text-xs text-good font-semibold">▲ 24%</div>
                    </div>
                  </div>
                  <div className="border border-hair rounded-xl p-[18px] h-[150px] flex items-end gap-2.5">
                    <div className="flex-1 bg-barlo rounded-t-md h-[40%]" />
                    <div className="flex-1 bg-barmid rounded-t-md h-[62%]" />
                    <div className="flex-1 bg-barhi rounded-t-md h-[50%]" />
                    <div className="flex-1 bg-brand rounded-t-md h-[88%]" />
                    <div className="flex-1 bg-barhi rounded-t-md h-[70%]" />
                    <div className="flex-1 bg-barmid rounded-t-md h-[56%]" />
                    <div className="flex-1 bg-barlo rounded-t-md h-[78%]" />
                  </div>
                </div>
              )}

              {/* m1 — live AI demo calls */}
              {vals.moment === 1 && (
                <div className="dl-page p-[22px] h-full">
                  <div className="text-[22px] font-extrabold tracking-[-.02em] mb-1">
                    Live AI demo calls
                  </div>
                  <div className="text-[13px] text-muted2 mb-4">
                    Every visitor gets a scored, summarized call, automatically.
                  </div>
                  <div className="border border-hair rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] px-4 py-[11px] bg-wash text-[11px] tracking-[.06em] uppercase text-faint font-semibold">
                      <span>Company</span>
                      <span>Role</span>
                      <span>Use case</span>
                      <span>Score</span>
                    </div>
                    <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] px-4 py-[13px] border-t border-hair text-sm items-center">
                      <span className="font-semibold">Northwind Co</span>
                      <span className="text-muted">VP Sales</span>
                      <span className="text-muted">Outbound</span>
                      <span className="text-good font-bold">88</span>
                    </div>
                    <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] px-4 py-[13px] border-t border-hair text-sm items-center bg-brandsoft2 shadow-[inset_3px_0_0_#4f46e5]">
                      <span className="font-bold">Cadence Labs</span>
                      <span className="text-muted">RevOps</span>
                      <span className="text-muted">PLG</span>
                      <span className="text-branddeep font-bold">81</span>
                    </div>
                    <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] px-4 py-[13px] border-t border-hair text-sm items-center">
                      <span className="font-semibold">Verite</span>
                      <span className="text-muted">Founder</span>
                      <span className="text-muted">Inbound</span>
                      <span className="text-warn font-bold">63</span>
                    </div>
                    <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] px-4 py-[13px] border-t border-hair text-sm items-center">
                      <span className="font-semibold">Loop HQ</span>
                      <span className="text-muted">Marketing</span>
                      <span className="text-muted">Channel</span>
                      <span className="text-good font-bold">90</span>
                    </div>
                  </div>
                </div>
              )}

              {/* m2 — pricing */}
              {vals.moment === 2 && (
                <div className="dl-page p-[22px] h-full">
                  <div className="text-center mb-[18px]">
                    <div className="text-[22px] font-extrabold tracking-[-.02em]">
                      Pricing that scales with demos, not seats
                    </div>
                    <div className="text-[13px] text-muted2 mt-1">
                      Tailored to {vals.form.size} employees
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-[14px]">
                    <div className="border border-hair rounded-xl p-5">
                      <div className="text-[13px] font-bold text-muted">
                        Starter
                      </div>
                      <div className="text-[30px] font-extrabold tracking-[-.02em] my-2">
                        $0
                      </div>
                      <div className="text-xs text-faint">50 demos / mo</div>
                    </div>
                    <div className="border-2 border-brand rounded-xl p-5 shadow-[0_0_0_4px_#eef0ff] relative">
                      <span className="absolute -top-2.5 left-5 bg-brand text-white text-[10px] font-bold px-[9px] py-[3px] rounded-full">
                        RECOMMENDED
                      </span>
                      <div className="text-[13px] font-bold text-branddeep">
                        Growth
                      </div>
                      <div className="text-[30px] font-extrabold tracking-[-.02em] my-2">
                        $1,200
                        <span className="text-sm text-faint">/mo</span>
                      </div>
                      <div className="text-xs text-faint">
                        Unlimited demos · CRM sync
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-5">
                      <div className="text-[13px] font-bold text-muted">
                        Enterprise
                      </div>
                      <div className="text-[30px] font-extrabold tracking-[-.02em] my-2">
                        Custom
                      </div>
                      <div className="text-xs text-faint">SSO · SLA · residency</div>
                    </div>
                  </div>
                </div>
              )}

              {/* m3 — integrations */}
              {vals.moment === 3 && (
                <div className="dl-page p-[22px] h-full">
                  <div className="text-[22px] font-extrabold tracking-[-.02em] mb-1">
                    Drops into your stack
                  </div>
                  <div className="text-[13px] text-muted2 mb-[18px]">
                    Leads and call data sync the moment a demo ends.
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border-2 border-brand rounded-xl p-[18px] shadow-[0_0_0_4px_#eef0ff] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#f1f5f9]" />
                      <div>
                        <div className="text-sm font-bold">Salesforce</div>
                        <div className="text-[11px] text-good font-semibold">
                          Connected
                        </div>
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#fef2f0]" />
                      <div>
                        <div className="text-sm font-bold">HubSpot</div>
                        <div className="text-[11px] text-faint">1-click</div>
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#f3f0fb]" />
                      <div>
                        <div className="text-sm font-bold">Slack</div>
                        <div className="text-[11px] text-faint">1-click</div>
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#eef6f0]" />
                      <div>
                        <div className="text-sm font-bold">Segment</div>
                        <div className="text-[11px] text-faint">1-click</div>
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#fdf6e9]" />
                      <div>
                        <div className="text-sm font-bold">Zapier</div>
                        <div className="text-[11px] text-faint">5,000+ apps</div>
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#f1f5f9]" />
                      <div>
                        <div className="text-sm font-bold">Gmail</div>
                        <div className="text-[11px] text-faint">1-click</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* m4 — security */}
              {vals.moment === 4 && (
                <div className="dl-page p-[22px] h-full">
                  <div className="text-[22px] font-extrabold tracking-[-.02em] mb-1">
                    Enterprise-grade by default
                  </div>
                  <div className="text-[13px] text-muted2 mb-[18px]">
                    Because your AI rep is talking to real buyers.
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border-2 border-brand rounded-xl p-[18px] shadow-[0_0_0_4px_#eef0ff]">
                      <div className="w-7 h-7 rounded-lg bg-brandsoft mb-3 flex items-center justify-center">
                        <div className="w-[11px] h-[11px] border-2 border-brand rounded-[3px]" />
                      </div>
                      <div className="text-sm font-bold">SOC 2 Type II</div>
                      <div className="text-xs text-muted2 mt-[3px]">
                        Audited annually
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px]">
                      <div className="w-7 h-7 rounded-lg bg-wash2 mb-3" />
                      <div className="text-sm font-bold">SSO / SAML</div>
                      <div className="text-xs text-muted2 mt-[3px]">
                        Okta, Azure AD
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px]">
                      <div className="w-7 h-7 rounded-lg bg-wash2 mb-3" />
                      <div className="text-sm font-bold">GDPR</div>
                      <div className="text-xs text-muted2 mt-[3px]">
                        DPA on request
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px]">
                      <div className="w-7 h-7 rounded-lg bg-wash2 mb-3" />
                      <div className="text-sm font-bold">Encryption</div>
                      <div className="text-xs text-muted2 mt-[3px]">
                        At rest &amp; in transit
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px]">
                      <div className="w-7 h-7 rounded-lg bg-wash2 mb-3" />
                      <div className="text-sm font-bold">Data residency</div>
                      <div className="text-xs text-muted2 mt-[3px]">
                        US / EU regions
                      </div>
                    </div>
                    <div className="border border-hair rounded-xl p-[18px]">
                      <div className="w-7 h-7 rounded-lg bg-wash2 mb-3" />
                      <div className="text-sm font-bold">Pen-tested</div>
                      <div className="text-xs text-muted2 mt-[3px]">
                        Quarterly · 3rd party
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* m5 — ROI */}
              {vals.moment === 5 && (
                <div className="dl-page p-[22px] h-full flex gap-[18px]">
                  <div className="flex-1">
                    <div className="text-[22px] font-extrabold tracking-[-.02em] mb-1">
                      Your ROI
                    </div>
                    <div className="text-[13px] text-muted2 mb-[18px]">
                      Based on a {vals.form.size}-person team running outbound.
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="border border-hair rounded-[10px] p-[14px]">
                        <div className="text-xs text-muted2">Demos / week</div>
                        <div className="text-[22px] font-extrabold">48</div>
                      </div>
                      <div className="border border-hair rounded-[10px] p-[14px]">
                        <div className="text-xs text-muted2">
                          Rep minutes / demo
                        </div>
                        <div className="text-[22px] font-extrabold">35</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 border-2 border-brand rounded-[14px] p-[22px] bg-brandsoft2 shadow-[0_0_0_4px_#eef0ff] flex flex-col justify-center">
                    <div className="text-xs tracking-[.08em] uppercase text-branddeep font-bold font-mono">
                      Projected impact
                    </div>
                    <div className="mt-4">
                      <div className="text-[13px] text-muted">
                        Rep-hours reclaimed / week
                      </div>
                      <div className="text-[38px] font-extrabold tracking-[-.03em] text-branddeep">
                        12.4
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-[13px] text-muted">
                        Added pipeline / quarter
                      </div>
                      <div className="text-[38px] font-extrabold tracking-[-.03em] text-branddeep">
                        $418K
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* m6 — testimonial */}
              {vals.moment === 6 && (
                <div className="dl-page p-[22px] h-full">
                  <div className="text-[22px] font-extrabold tracking-[-.02em] mb-4">
                    Teams that ditched the demo queue
                  </div>
                  <div className="flex gap-9 mb-5 opacity-50">
                    <span className="text-xl font-extrabold">Northwind</span>
                    <span className="text-xl font-extrabold">Cadence</span>
                    <span className="text-xl font-extrabold">Verite</span>
                    <span className="text-xl font-extrabold">Loop HQ</span>
                  </div>
                  <div className="border-2 border-brand rounded-[14px] p-6 shadow-[0_0_0_4px_#eef0ff]">
                    <div className="text-xl font-bold leading-[1.4] tracking-[-.01em] mb-[18px]">
                      “We replaced ‘Book a demo’ overnight. Qualified pipeline is
                      up 3× and our AEs only join the calls that are actually
                      ready.”
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone300" />
                      <div>
                        <div className="text-sm font-bold">Priya Menon</div>
                        <div className="text-xs text-muted2">
                          VP Sales, Cadence Labs
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-2xl font-extrabold text-branddeep">
                          3×
                        </div>
                        <div className="text-[11px] text-faint">
                          qualified pipeline
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* convert overlay */}
              {vals.isConvert && (
                <div className="dl-page absolute inset-0 bg-night/[.55] backdrop-blur-[3px] flex items-center justify-center p-6">
                  <div className="bg-white rounded-[18px] p-8 w-full max-w-[480px] shadow-[0_24px_60px_rgba(0,0,0,.35)]">
                    <div className="text-[22px] font-extrabold tracking-[-.02em] text-center">
                      That’s the tour, where to next?
                    </div>
                    <div className="text-sm text-muted2 text-center mt-1.5 mb-6">
                      {agentName} can hand you off in one click.
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={vals.goDashboard}
                        className="w-full bg-brand text-white border-none p-[15px] rounded-xl text-base font-bold cursor-pointer flex items-center justify-between"
                      >
                        <span>Start free trial</span>
                        <span>→</span>
                      </button>
                      <button className="w-full bg-white text-ink border border-line3 p-[15px] rounded-xl text-base font-semibold cursor-pointer flex items-center justify-between">
                        <span>Request pricing</span>
                        <span>→</span>
                      </button>
                      <button className="w-full bg-white text-ink border border-line3 p-[15px] rounded-xl text-base font-semibold cursor-pointer flex items-center justify-between">
                        <span>Book a human AE</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* auto-advancing progress bar */}
              {!vals.isConvert && (
                <div
                  key={vals.moment}
                  onAnimationEnd={vals.advance}
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    height: "3px",
                    background: "#4f46e5",
                    animation: "dlStep 5.5s linear forwards",
                    animationPlayState: vals.paused ? "paused" : "running",
                    zIndex: 5,
                  }}
                />
              )}
            </div>

            {/* Rep video tile */}
            <div className="absolute right-[14px] bottom-[14px] w-[168px] h-[116px] rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,.4)] border-2 border-brand">
              <div className="w-full h-full block bg-gradient-to-br from-coal to-brand" />
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_-40px_30px_-20px_rgba(0,0,0,.5)]" />
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

            {/* Captions overlay */}
            {vals.captionsOn && (
              <div className="absolute left-[14px] bottom-[14px] max-w-[58%] flex flex-col gap-1.5">
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

        {/* Demo sections rail */}
        <div className="w-[224px] flex-none bg-night2 rounded-[14px] p-4 flex flex-col">
          <div className="text-[11px] tracking-[.1em] uppercase text-dim font-bold font-mono mb-[14px]">
            Demo sections
          </div>
          <div className="flex flex-col gap-[3px] flex-1">
            {vals.sectionItems.map((s, i) => (
              <button
                key={i}
                onClick={s.go}
                className="flex items-center gap-2.5 px-2.5 py-[9px] rounded-[9px] border-none cursor-pointer text-left"
                style={{ background: s.bg }}
              >
                <span
                  className="w-[18px] h-[18px] rounded-full flex-none flex items-center justify-center text-[11px] font-bold"
                  style={{ background: s.dotBg, color: s.dotColor }}
                >
                  {s.mark}
                </span>
                <span
                  className="text-[13px]"
                  style={{ fontWeight: s.weight, color: s.color }}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-coalline pt-3 mt-1.5">
            <div className="flex items-center justify-between text-[11px] text-faint2 font-mono mb-1.5">
              <span>Progress</span>
              <span>{vals.progressLabel}</span>
            </div>
            <div className="h-[5px] rounded-[3px] bg-coalline overflow-hidden">
              <div
                className="h-full bg-brand rounded-[3px] transition-[width] duration-[.4s]"
                style={{ width: vals.progressPct }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex-none flex items-center justify-center gap-3 px-5 pt-1 pb-[18px] relative">
        <button
          onClick={() => (voice.active ? voice.stop() : void voice.start())}
          title={voice.active ? `Stop talking to ${agentName}` : `Talk to ${agentName}`}
          className="w-[50px] h-[50px] rounded-full border-none cursor-pointer text-[19px] flex items-center justify-center"
          style={{
            background: voice.active ? "#4f46e5" : "#dc2626",
            color: "#fff",
          }}
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
          onClick={vals.togglePause}
          className="w-[50px] h-[50px] rounded-full border-none cursor-pointer bg-coal text-line text-base flex items-center justify-center"
        >
          {vals.pauseIcon}
        </button>
        <button
          onClick={vals.goDashboard}
          className="h-[50px] px-6 rounded-[25px] border-none cursor-pointer bg-danger text-white text-[15px] font-bold flex items-center gap-2"
        >
          End call
        </button>
        <div className="absolute right-5 text-xs font-mono">
          {voice.error ? (
            <span className="text-danger">{voice.error}</span>
          ) : (
            <span className="text-dim">
              {voice.active ? statusLabel(voice.status, agentName) : `${agentName} is presenting`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
