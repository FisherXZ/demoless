"use client";

import { useState } from "react";
import {
  SECTIONS,
  CAPTIONS,
  LEADS,
  PIPELINE,
  STAGE_COLOR,
  scoreColor,
  intentMeta,
} from "./data";
import type {
  DemoVals,
  FormState,
  Screen,
  SectionItem,
  Column,
  SelectedLead,
} from "./types";

interface DemoState {
  screen: Screen;
  moment: number;
  paused: boolean;
  muted: boolean;
  camOff: boolean;
  captionsOn: boolean;
  selectedId: string | null;
  elapsed: number;
  form: FormState;
}

const initialState: DemoState = {
  screen: "landing",
  moment: 0,
  paused: false,
  muted: true,
  camOff: true,
  captionsOn: true,
  selectedId: null,
  elapsed: 0,
  form: {
    name: "",
    email: "",
    role: "VP of Sales",
    size: "51–200",
    useCase: "Outbound sales",
    pain: "",
  },
};

export function useDemoState(): DemoVals {
  const [s, set] = useState<DemoState>(initialState);

  const patch = (p: Partial<DemoState>) => set((prev) => ({ ...prev, ...p }));
  const setF = (k: keyof FormState, v: string) =>
    set((prev) => ({ ...prev, form: { ...prev.form, [k]: v } }));

  const m = s.moment;
  const form = s.form;
  const tailoredFor =
    (form.role || "Growth team") + " · " + (form.useCase || "Outbound");

  const sectionItems: SectionItem[] = SECTIONS.map((label, i) => {
    const done = i < m;
    const active = i === m;
    return {
      label,
      go: () => patch({ moment: i, elapsed: i }),
      mark: done ? "✓" : "",
      bg: active ? "#2f2e6b" : "transparent",
      dotBg: done ? "#4f46e5" : active ? "#4f46e5" : "#34332f",
      dotColor: done || active ? "#fff" : "#6b6b66",
      color: active ? "#fff" : done ? "#cfcdc8" : "#8a8782",
      weight: active ? 700 : 500,
    };
  });

  const progressPct = Math.round((m / 7) * 100) + "%";

  const columns: Column[] = PIPELINE.map((stage) => {
    const leads = LEADS.filter((l) => l.stage === stage).map((l) => {
      const im = intentMeta(l.intent);
      return {
        ...l,
        open: () => patch({ selectedId: l.id }),
        scoreColorHex: scoreColor(l.score),
        intentLabel: im.label,
        intentColor: im.color,
        intentBg: im.bg,
      };
    });
    return { stage, color: STAGE_COLOR[stage], count: leads.length, leads };
  });

  const selRaw = LEADS.find((l) => l.id === s.selectedId) || null;
  let sel: SelectedLead | null = null;
  if (selRaw) {
    const im = intentMeta(selRaw.intent);
    sel = {
      ...selRaw,
      scoreColorHex: scoreColor(selRaw.score),
      intentLabel: im.label,
      intentColor: im.color,
      intentPct: selRaw.intent + "%",
      painPointsView: selRaw.painPoints.map((t) => ({ text: t })),
      objectionsView: selRaw.objections.length
        ? selRaw.objections.map((t) => ({ text: t }))
        : [{ text: "None raised, clean call." }],
      sectionsView: SECTIONS.map((label, i) => {
        const v = selRaw.viewed[i];
        return {
          label,
          mark: v ? "✓" : "–",
          bg: v ? "#eef0ff" : "#faf9f8",
          color: v ? "#4338ca" : "#a8a29e",
          border: v ? "#dcdcfa" : "#f0efed",
        };
      }),
    };
  }

  return {
    screen: s.screen,

    goLanding: () => patch({ screen: "landing" }),
    goForm: () => patch({ screen: "form" }),
    goDashboard: () => patch({ screen: "dashboard", selectedId: null }),
    startDemo: () =>
      patch({ screen: "room", moment: 0, elapsed: 0, paused: false }),

    form,
    onName: (e) => setF("name", e.target.value),
    onEmail: (e) => setF("email", e.target.value),
    onRole: (e) => setF("role", e.target.value),
    onSize: (e) => setF("size", e.target.value),
    onUseCase: (e) => setF("useCase", e.target.value),
    onPain: (e) => setF("pain", e.target.value),

    tailoredFor,
    clock:
      "0" +
      Math.min(2, Math.floor(m / 3)) +
      ":" +
      String((m * 21) % 60).padStart(2, "0"),
    shareLabel: SECTIONS[m],
    caption: CAPTIONS[m],
    captionsOn: s.captionsOn,
    moment: m,
    isConvert: m === 7,

    sectionItems,
    progressPct,
    progressLabel: m + 1 + " / 8",

    paused: s.paused,
    advance: () =>
      set((prev) => ({
        ...prev,
        moment: Math.min(7, prev.moment + 1),
        elapsed: Math.min(7, prev.moment + 1),
      })),

    muted: s.muted,
    toggleMute: () => patch({ muted: !s.muted }),
    micIcon: s.muted ? "🔇" : "🎙",
    micBg: s.muted ? "#dc2626" : "#2a2a28",
    micColor: "#fff",

    camOff: s.camOff,
    toggleCam: () => patch({ camOff: !s.camOff }),
    camIcon: s.camOff ? "📷" : "📹",
    camBg: s.camOff ? "#2a2a28" : "#4f46e5",
    camColor: "#e7e5e4",

    toggleCaptions: () => patch({ captionsOn: !s.captionsOn }),
    ccBg: s.captionsOn ? "#4f46e5" : "#2a2a28",
    ccColor: s.captionsOn ? "#fff" : "#8a8782",

    togglePause: () => patch({ paused: !s.paused }),
    pauseIcon: s.paused ? "▶" : "❚❚",

    columns,
    sel,
    detailOpen: !!sel,
    closeDetail: () => patch({ selectedId: null }),
  };
}
