"use client";

import type { DemoVals } from "@/lib/types";

export default function Dashboard({ vals }: { vals: DemoVals }) {
  const sel = vals.sel;

  return (
    <div className="flex min-h-screen bg-wash3">
      <aside className="flex w-[210px] flex-none flex-col bg-night px-4 py-5 text-white">
        <div className="flex items-center gap-2.5 px-1.5 pb-6 pt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white">
            <div className="h-[11px] w-[11px] rounded-full bg-brand" />
          </div>
          <span className="text-[17px] font-extrabold">Demoless</span>
        </div>
        <nav className="flex flex-col gap-[3px]">
          <div className="flex items-center gap-[11px] rounded-[9px] bg-coal px-3 py-2.5 text-sm font-semibold">
            <span className="h-[7px] w-[7px] rounded-sm bg-brand" />
            Pipeline
          </div>
          <div className="flex items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-sm text-faint">
            <span className="h-[7px] w-[7px] rounded-sm bg-coal2" />
            All calls
          </div>
          <div className="flex items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-sm text-faint">
            <span className="h-[7px] w-[7px] rounded-sm bg-coal2" />
            Analytics
          </div>
          <div className="flex items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-sm text-faint">
            <span className="h-[7px] w-[7px] rounded-sm bg-coal2" />
            Demo builder
          </div>
          <div className="flex items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-sm text-faint">
            <span className="h-[7px] w-[7px] rounded-sm bg-coal2" />
            Settings
          </div>
        </nav>
        <div className="mt-auto flex items-center gap-2.5 px-2 py-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand text-xs font-bold">
            AE
          </div>
          <div>
            <div className="text-[13px] font-semibold">Alex Rivera</div>
            <div className="text-[11px] text-faint2">Account Exec</div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-wash4 px-7 py-5">
          <div>
            <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">Pipeline</h1>
            <p className="mb-0 ml-0 mr-0 mt-[3px] text-[13px] text-muted2">
              42 AI demos this week · 18 qualified · 6 need a human
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-[9px] border border-line3 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-muted">
              This week ▾
            </span>
            <button
              onClick={vals.goLanding}
              className="cursor-pointer rounded-[9px] border-none bg-brand px-3.5 py-2.5 text-[13px] font-semibold text-white"
            >
              View landing page
            </button>
          </div>
        </header>

        <div className="dl-scroll flex-1 overflow-x-auto overflow-y-hidden px-7 py-5">
          <div className="flex h-full min-w-max gap-4">
            {vals.columns.map((col) => (
              <div key={col.stage} className="flex w-[268px] flex-none flex-col">
                <div className="mb-3 flex items-center gap-[9px] px-0.5">
                  <span
                    className="h-[9px] w-[9px] rounded-[3px]"
                    style={{ background: col.color }}
                  />
                  <span className="text-sm font-bold">{col.stage}</span>
                  <span className="rounded-full bg-line2 px-2 py-px text-xs font-semibold text-faint">
                    {col.count}
                  </span>
                </div>
                <div className="dl-scroll flex flex-col gap-2.5 overflow-y-auto px-0.5 pb-4 pt-0.5">
                  {col.leads.map((ld) => (
                    <button
                      key={ld.id}
                      onClick={ld.open}
                      className="block w-full cursor-pointer rounded-xl border border-line2 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,.03)] hover:border-barhi hover:shadow-[0_4px_14px_rgba(79,70,229,.12)]"
                    >
                      <div className="mb-[9px] flex items-center justify-between">
                        <div className="flex items-center gap-[9px]">
                          <span
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[11px] font-extrabold"
                            style={{ background: ld.logoBg, color: ld.logoColor }}
                          >
                            {ld.initials}
                          </span>
                          <span className="text-sm font-bold">{ld.company}</span>
                        </div>
                        <span
                          className="text-xs font-extrabold"
                          style={{ color: ld.scoreColorHex }}
                        >
                          {ld.score}
                        </span>
                      </div>
                      <div className="mb-2.5 text-xs text-muted2">
                        {ld.role} · {ld.size}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-chip px-2 py-[3px] text-[11px] font-semibold text-muted">
                          {ld.useCase}
                        </span>
                        <span
                          className="rounded-md px-2 py-[3px] text-[11px] font-semibold"
                          style={{ background: ld.intentBg, color: ld.intentColor }}
                        >
                          {ld.intentLabel} intent
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {vals.detailOpen && (
        <>
          <div
            onClick={vals.closeDetail}
            className="fixed inset-0 z-30 bg-[rgba(28,28,26,.32)]"
          />
          <aside
            className="fixed bottom-0 right-0 top-0 z-[31] flex w-[460px] flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,.16)]"
            style={{ animation: "dlFade .3s ease" }}
          >
            <div className="dl-scroll flex-1 overflow-y-auto px-7 py-[26px]">
              {sel && (
                <>
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-[11px] text-base font-extrabold"
                        style={{ background: sel.logoBg, color: sel.logoColor }}
                      >
                        {sel.initials}
                      </span>
                      <div>
                        <div className="text-[19px] font-extrabold tracking-[-0.01em]">
                          {sel.company}
                        </div>
                        <div className="text-[13px] text-muted2">
                          {sel.role} · {sel.size} employees
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={vals.closeDetail}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-line2 bg-white text-base text-muted2"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mb-[22px] grid grid-cols-2 gap-2.5">
                    <div className="rounded-[11px] border border-hair p-3.5">
                      <div className="mb-1.5 text-xs text-muted2">Lead score</div>
                      <div
                        className="text-[26px] font-extrabold"
                        style={{ color: sel.scoreColorHex }}
                      >
                        {sel.score}
                        <span className="text-sm font-semibold text-faint">/100</span>
                      </div>
                    </div>
                    <div className="rounded-[11px] border border-hair p-3.5">
                      <div className="mb-2 text-xs text-muted2">Buying intent</div>
                      <div className="mb-[7px] h-2 overflow-hidden rounded bg-hair">
                        <div
                          className="h-full rounded"
                          style={{ background: sel.intentColor, width: sel.intentPct }}
                        />
                      </div>
                      <div
                        className="text-xs font-bold"
                        style={{ color: sel.intentColor }}
                      >
                        {sel.intentLabel}
                      </div>
                    </div>
                  </div>

                  <div className="mb-[22px]">
                    <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-[.08em] text-faint">
                      Use case &amp; pain points
                    </div>
                    <span className="mb-2.5 inline-block rounded-[7px] bg-brandsoft px-[11px] py-[5px] text-[13px] font-semibold text-branddeep">
                      {sel.useCase}
                    </span>
                    <div className="flex flex-col gap-[7px]">
                      {sel.painPointsView.map((p, i) => (
                        <div
                          key={i}
                          className="flex gap-[9px] text-sm leading-[1.4] text-ink2"
                        >
                          <span className="flex-none text-danger">●</span>
                          <span>{p.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-[22px]">
                    <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-[.08em] text-faint">
                      Objections raised
                    </div>
                    <div className="flex flex-col gap-[7px]">
                      {sel.objectionsView.map((o, i) => (
                        <div
                          key={i}
                          className="flex gap-[9px] text-sm leading-[1.4] text-ink2"
                        >
                          <span className="flex-none text-warn">“</span>
                          <span>{o.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-[22px]">
                    <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-[.08em] text-faint">
                      Demo sections viewed
                    </div>
                    <div className="flex flex-wrap gap-[7px]">
                      {sel.sectionsView.map((sv, i) => (
                        <span
                          key={i}
                          className="rounded-[7px] px-2.5 py-[5px] text-xs font-semibold"
                          style={{
                            background: sv.bg,
                            color: sv.color,
                            border: `1px solid ${sv.border}`,
                          }}
                        >
                          {sv.mark} {sv.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-[18px] rounded-[13px] border border-line2 bg-wash p-[18px]">
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-brand">
                        <span className="h-[7px] w-[7px] rounded-full bg-white" />
                      </span>
                      <span className="text-[13px] font-bold">AI call summary</span>
                    </div>
                    <p className="m-0 text-sm leading-[1.55] text-ink2">{sel.summary}</p>
                  </div>

                  <div className="rounded-[13px] border-2 border-brand bg-brandsoft2 p-[18px]">
                    <div className="mb-2 font-mono text-xs font-bold uppercase tracking-[.08em] text-branddeep">
                      Recommended follow-up
                    </div>
                    <p className="mb-3.5 ml-0 mr-0 mt-0 text-sm leading-[1.5] text-indigotext">
                      {sel.followUp}
                    </p>
                    <button className="w-full cursor-pointer rounded-[10px] border-none bg-brand p-[13px] text-[15px] font-bold text-white">
                      {sel.followUpCta}
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
