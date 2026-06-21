import type { ChangeEvent } from "react";

export type Screen = "landing" | "form" | "room" | "dashboard";

/** Manually-entered pre-call fields. Identity (name/email) now comes from the
 *  verified Google session, not this form. */
export interface FormState {
  role: string;
  size: string;
  useCase: string;
  pain: string;
}

export type FieldChange = (
  e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

export interface Lead {
  id: string;
  company: string;
  initials: string;
  logoBg: string;
  logoColor: string;
  role: string;
  size: string;
  useCase: string;
  score: number;
  intent: number;
  stage: string;
  needsHuman?: boolean;
  closed?: boolean;
  painPoints: string[];
  objections: string[];
  viewed: number[];
  summary: string;
  followUp: string;
  followUpCta: string;
}

/** A demo-room section entry in the left rail. Colors are hex strings
 *  applied via inline style because they are state-driven. */
export interface SectionItem {
  label: string;
  go: () => void;
  mark: string; // "✓" when done, "" otherwise
  bg: string;
  dotBg: string;
  dotColor: string;
  color: string;
  weight: number;
}

export interface LeadCard extends Lead {
  open: () => void;
  scoreColorHex: string;
  intentLabel: string;
  intentColor: string;
  intentBg: string;
}

export interface Column {
  stage: string;
  color: string;
  count: number;
  leads: LeadCard[];
}

export interface SectionView {
  label: string;
  mark: string; // "✓" or "–"
  bg: string;
  color: string;
  border: string;
}

export interface SelectedLead extends Lead {
  scoreColorHex: string;
  intentLabel: string;
  intentColor: string;
  intentPct: string;
  painPointsView: { text: string }[];
  objectionsView: { text: string }[];
  sectionsView: SectionView[];
}

/** The single object returned by useDemoState() and passed to every screen.
 *  Mirrors the original prototype's renderVals() output. */
export interface DemoVals {
  screen: Screen;

  goLanding: () => void;
  goForm: () => void;
  goDashboard: () => void;
  startDemo: () => void;

  // Google auth (Auth.js). Identity is verified, not typed.
  authStatus: "loading" | "authenticated" | "unauthenticated";
  isAuthed: boolean;
  authEmail?: string;
  authName?: string;
  signInGoogle: () => void;
  signOutGoogle: () => void;
  canStart: boolean; // gate: demo can only start once signed in
  recallLine?: string; // "welcome back…" for returning buyers

  form: FormState;
  onRole: FieldChange;
  onSize: FieldChange;
  onUseCase: FieldChange;
  onPain: FieldChange;

  tailoredFor: string;
  clock: string;
  shareLabel: string;
  caption: string;
  captionsOn: boolean;
  moment: number; // 0..7 ; 7 === convert overlay
  isConvert: boolean;

  sectionItems: SectionItem[];
  progressPct: string;
  progressLabel: string;

  paused: boolean;
  advance: () => void;

  muted: boolean;
  toggleMute: () => void;
  micIcon: string;
  micBg: string;
  micColor: string;

  camOff: boolean;
  toggleCam: () => void;
  camIcon: string;
  camBg: string;
  camColor: string;

  toggleCaptions: () => void;
  ccBg: string;
  ccColor: string;

  togglePause: () => void;
  pauseIcon: string;

  columns: Column[];
  sel: SelectedLead | null;
  detailOpen: boolean;
  closeDetail: () => void;
}
