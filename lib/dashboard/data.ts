// Seeded session corpus for the customer-facing dashboard.
//
// Framing: Demoless's customer here is Browserbase's GTM team. Each Session is a
// prospect (usually a dev team) who took a live Demoless-run demo of Browserbase.
// Signals/objections are Browserbase-flavored. The dashboard turns each demo into
// scored sales intelligence. KPIs, donuts, and the timeline are derived from this
// array (see helpers at the bottom), so the numbers are real, not hardcoded.
//
// Shape aligns with the loop's Scorecard contract (see DESIGN.md / roadmap): the
// LM emits most of this at WRAP; here it's pre-baked so the surfaces render now.

export type SignalType = "interest" | "objection" | "role" | "question";

export interface Signal {
  type: SignalType;
  value: string;
  at: string; // in-session timestamp mm:ss
}

export interface Buyer {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  employees: string;
  industry: string;
  initials: string;
  logoBg: string;
  logoColor: string;
}

export interface Session {
  id: string;
  buyer: Buyer;
  scenario: "browserbase" | "demoless";
  startedLabel: string; // relative, e.g. "2m ago"
  dayIndex: number; // 0 = oldest bucket .. for the timeline
  durationSec: number;
  device: "Desktop" | "Mobile";
  source: "Direct" | "Docs" | "Referral";
  score: number; // 0-100 lead score
  qualified: boolean;
  status: "active" | "ended";
  live?: boolean; // the on-stage live session
  summary: string;
  signals: Signal[];
  opportunities: string[];
  decisionMakers: string[];
  followUp: { text: string; cta: string };
  replayUrl?: string;
}

// ---- intent / score helpers -------------------------------------------------

export function intentOf(score: number): "High" | "Medium" | "Low" {
  return score >= 75 ? "High" : score >= 55 ? "Medium" : "Low";
}
export function scoreColor(n: number): string {
  return n >= 80 ? "good" : n >= 65 ? "branddeep" : "warn";
}
export function intentColor(score: number): string {
  const i = intentOf(score);
  return i === "High" ? "good" : i === "Medium" ? "warn" : "muted2";
}

// ---- the corpus -------------------------------------------------------------

const LOGO = {
  indigo: { logoBg: "#eaecfb", logoColor: "#262aa6" },
  green: { logoBg: "#e7f6ec", logoColor: "#15803d" },
  amber: { logoBg: "#fcf3e6", logoColor: "#b45309" },
};

export const SESSIONS: Session[] = [
  {
    id: "s1",
    buyer: {
      id: "b1",
      name: "Priya Menon",
      email: "priya@cadencelabs.io",
      company: "Cadence Labs",
      role: "VP Engineering",
      employees: "51–200",
      industry: "Dev tools",
      initials: "CL",
      ...LOGO.indigo,
    },
    scenario: "browserbase",
    startedLabel: "2m ago",
    dayIndex: 8,
    durationSec: 252,
    device: "Desktop",
    source: "Direct",
    score: 88,
    qualified: true,
    status: "ended",
    summary:
      "Ran a 4-minute demo of Browserbase focused on session concurrency and the live-view embed. Pushed on SOC 2 and on-prem, lit up around Stagehand's plain-English control. Evaluating against an in-house Playwright cluster — high intent.",
    signals: [
      { type: "role", value: "VP Engineering, owns the build-vs-buy call", at: "00:38" },
      { type: "interest", value: "Excited about Stagehand plain-English control", at: "02:10" },
      { type: "objection", value: "Needs SOC 2 Type II before procurement", at: "03:01" },
      { type: "question", value: "Asked about max concurrent sessions per project", at: "03:34" },
    ],
    opportunities: [
      "Send concurrency benchmark vs self-hosted Playwright",
      "Loop in security on SOC 2 + DPA",
    ],
    decisionMakers: ["Priya Menon — VP Eng (economic buyer)"],
    followUp: {
      text: "Send the concurrency benchmark and offer a 20-min architecture call with an SE this week.",
      cta: "Send benchmark + book SE",
    },
    replayUrl: "",
  },
  {
    id: "s2",
    buyer: {
      id: "b2",
      name: "Dev Anand",
      email: "dev@northwind.co",
      company: "Northwind",
      role: "Staff Engineer",
      employees: "201–1,000",
      industry: "E-commerce",
      initials: "NW",
      ...LOGO.indigo,
    },
    scenario: "browserbase",
    startedLabel: "14m ago",
    dayIndex: 8,
    durationSec: 188,
    device: "Desktop",
    source: "Docs",
    score: 74,
    qualified: false,
    status: "ended",
    summary:
      "Came from the docs. Tested the quickstart, asked about proxies and captcha handling for scraping retail sites. Medium intent — comparing against a scrappy in-house setup.",
    signals: [
      { type: "role", value: "Staff Engineer, hands-on evaluator", at: "00:22" },
      { type: "interest", value: "Liked built-in stealth/proxy support", at: "01:40" },
      { type: "question", value: "Captcha handling on retail targets?", at: "02:05" },
    ],
    opportunities: ["Share stealth-mode docs + a retail scraping example"],
    decisionMakers: ["Dev Anand — Staff Eng (technical champion)"],
    followUp: {
      text: "Send the stealth-mode guide and a retail scraping recipe; check back in a week.",
      cta: "Send stealth guide",
    },
  },
  {
    id: "s3",
    buyer: {
      id: "b3",
      name: "Sara Lin",
      email: "sara@verite.ai",
      company: "Verite",
      role: "Founder / CTO",
      employees: "11–50",
      industry: "AI agents",
      initials: "VR",
      ...LOGO.green,
    },
    scenario: "browserbase",
    startedLabel: "1h ago",
    dayIndex: 7,
    durationSec: 301,
    device: "Desktop",
    source: "Direct",
    score: 91,
    qualified: true,
    status: "ended",
    summary:
      "Building an AI agent that needs reliable browser automation at scale. Completed the full walkthrough, especially the live-view + Stagehand combo for agent observability. Highest-intent session today — ready to start a paid project.",
    signals: [
      { type: "role", value: "Founder/CTO, full decision authority", at: "00:30" },
      { type: "interest", value: "Live-view is exactly what they need for agent debugging", at: "01:55" },
      { type: "interest", value: "Stagehand removes their selector-maintenance burden", at: "02:48" },
      { type: "question", value: "Usage-based pricing at 10k sessions/day?", at: "04:10" },
    ],
    opportunities: [
      "Send volume pricing for 10k+ sessions/day",
      "Offer a design-partner slot for the agent observability roadmap",
    ],
    decisionMakers: ["Sara Lin — Founder/CTO (economic + technical buyer)"],
    followUp: {
      text: "Send volume pricing and a design-partner invite; fast-track to a paid project.",
      cta: "Send pricing + DP invite",
    },
  },
  {
    id: "s4",
    buyer: {
      id: "b4",
      name: "Marcus Webb",
      email: "marcus@loophq.com",
      company: "Loop HQ",
      role: "Eng Manager",
      employees: "201–1,000",
      industry: "Marketing SaaS",
      initials: "LH",
      ...LOGO.green,
    },
    scenario: "browserbase",
    startedLabel: "2h ago",
    dayIndex: 7,
    durationSec: 142,
    device: "Mobile",
    source: "Referral",
    score: 61,
    qualified: false,
    status: "ended",
    summary:
      "Referred by a portfolio company. Short mobile session, watched the overview and pricing then dropped before the live demo. Low-medium intent, early research.",
    signals: [
      { type: "role", value: "Eng Manager, scoping options", at: "00:18" },
      { type: "objection", value: "Unsure if it beats their cron + headless Chrome", at: "01:30" },
    ],
    opportunities: ["Retarget with a reliability/uptime case study"],
    decisionMakers: ["Marcus Webb — Eng Manager"],
    followUp: {
      text: "Add to nurture; send a reliability case study vs self-hosted headless Chrome.",
      cta: "Add to nurture",
    },
  },
  {
    id: "s5",
    buyer: {
      id: "b5",
      name: "Jen Okoro",
      email: "jen@mistrallabs.dev",
      company: "Mistral Labs",
      role: "VP Engineering",
      employees: "1,000+",
      industry: "AI infra",
      initials: "ML",
      ...LOGO.indigo,
    },
    scenario: "browserbase",
    startedLabel: "3h ago",
    dayIndex: 6,
    durationSec: 274,
    device: "Desktop",
    source: "Direct",
    score: 83,
    qualified: true,
    status: "ended",
    summary:
      "Enterprise eval. Focused on concurrency limits, SSO, and data residency. Asked detailed compliance questions the agent flagged for human handoff. Real opportunity gated on a security review.",
    signals: [
      { type: "role", value: "VP Eng at 1,000+ org", at: "00:25" },
      { type: "objection", value: "Needs SOC 2 + EU data residency confirmed", at: "02:40" },
      { type: "question", value: "SSO / SAML support for the dashboard?", at: "03:15" },
      { type: "interest", value: "Concurrency ceiling fits their batch jobs", at: "03:52" },
    ],
    opportunities: ["Route to AE + SE", "Send SOC 2 Type II report, DPA, EU residency note"],
    decisionMakers: ["Jen Okoro — VP Eng", "Security review board (gate)"],
    followUp: {
      text: "Route to an AE + solutions engineer; send the full compliance pack.",
      cta: "Route to AE + SE",
    },
  },
  {
    id: "s6",
    buyer: {
      id: "b6",
      name: "Tom Reyes",
      email: "tom@northstar.io",
      company: "Northstar",
      role: "Founder",
      employees: "1–10",
      industry: "Fintech",
      initials: "NS",
      ...LOGO.amber,
    },
    scenario: "browserbase",
    startedLabel: "5h ago",
    dayIndex: 6,
    durationSec: 97,
    device: "Desktop",
    source: "Docs",
    score: 48,
    qualified: false,
    status: "ended",
    summary:
      "Very early. Skimmed the docs quickstart, bounced before pricing. Low intent, likely top-of-funnel.",
    signals: [{ type: "role", value: "Solo founder, exploring", at: "00:15" }],
    opportunities: ["Drip the getting-started series"],
    decisionMakers: ["Tom Reyes — Founder"],
    followUp: { text: "Add to the developer getting-started drip.", cta: "Add to drip" },
  },
  {
    id: "s7",
    buyer: {
      id: "b7",
      name: "Ana Costa",
      email: "ana@atlasfreight.com",
      company: "Atlas Freight",
      role: "Director of Eng",
      employees: "1,000+",
      industry: "Logistics",
      initials: "AF",
      ...LOGO.green,
    },
    scenario: "browserbase",
    startedLabel: "Yesterday",
    dayIndex: 5,
    durationSec: 263,
    device: "Desktop",
    source: "Direct",
    score: 86,
    qualified: true,
    status: "ended",
    summary:
      "Automating carrier-portal logins across regions. Full walkthrough, strong fit for scheduled jobs + live-view auditing. One light objection on CRM data hygiene. Multi-region expansion potential.",
    signals: [
      { type: "role", value: "Director of Eng, budget owner", at: "00:34" },
      { type: "interest", value: "Scheduled jobs + live-view for audit trails", at: "02:20" },
      { type: "objection", value: "Wants to confirm session data retention controls", at: "03:30" },
    ],
    opportunities: ["Map a multi-region rollout", "Send data-retention controls doc"],
    decisionMakers: ["Ana Costa — Director of Eng (budget owner)"],
    followUp: {
      text: "Schedule an architecture review and map a multi-region rollout.",
      cta: "Book architecture review",
    },
  },
  {
    id: "s8",
    buyer: {
      id: "b8",
      name: "Leah Park",
      email: "leah@verdant.app",
      company: "Verdant",
      role: "Founder / CEO",
      employees: "11–50",
      industry: "Climate tech",
      initials: "VD",
      ...LOGO.indigo,
    },
    scenario: "browserbase",
    startedLabel: "Yesterday",
    dayIndex: 5,
    durationSec: 318,
    device: "Desktop",
    source: "Referral",
    score: 93,
    qualified: true,
    status: "ended",
    summary:
      "Needed reliable scraping for an inbound data surge. Ran the full demo, started a project the same session. No objections. Reference-able.",
    signals: [
      { type: "role", value: "Founder/CEO, full authority", at: "00:28" },
      { type: "interest", value: "Time-to-first-session under a minute sold them", at: "01:10" },
      { type: "interest", value: "Pay-as-you-go fits their spiky load", at: "02:40" },
    ],
    opportunities: ["Request a logo + quote for the customers page"],
    decisionMakers: ["Leah Park — Founder/CEO"],
    followUp: {
      text: "Onboarding underway — request a reference quote and case study.",
      cta: "Request reference",
    },
  },
  {
    id: "s9",
    buyer: {
      id: "b9",
      name: "Raj Patel",
      email: "raj@brightwave.io",
      company: "Brightwave",
      role: "Senior Engineer",
      employees: "51–200",
      industry: "Analytics",
      initials: "BW",
      ...LOGO.amber,
    },
    scenario: "browserbase",
    startedLabel: "Yesterday",
    dayIndex: 4,
    durationSec: 121,
    device: "Desktop",
    source: "Docs",
    score: 57,
    qualified: false,
    status: "ended",
    summary:
      "Evaluated the API for a data pipeline. Asked about retries and timeouts, left mid-pricing. Medium-low intent.",
    signals: [
      { type: "interest", value: "Liked automatic retry/timeout handling", at: "01:25" },
      { type: "objection", value: "Cost vs their current free headless setup", at: "01:58" },
    ],
    opportunities: ["Send a cost-of-ownership comparison"],
    decisionMakers: ["Raj Patel — Senior Engineer"],
    followUp: { text: "Send a TCO comparison vs self-hosted.", cta: "Send TCO note" },
  },
  {
    id: "s10",
    buyer: {
      id: "b10",
      name: "Mia Schultz",
      email: "mia@helixdata.com",
      company: "Helix Data",
      role: "Head of Platform",
      employees: "201–1,000",
      industry: "Data infra",
      initials: "HD",
      ...LOGO.green,
    },
    scenario: "browserbase",
    startedLabel: "2 days ago",
    dayIndex: 3,
    durationSec: 244,
    device: "Desktop",
    source: "Direct",
    score: 79,
    qualified: true,
    status: "ended",
    summary:
      "Platform team standardizing browser automation across squads. Liked project-level isolation and usage dashboards. Qualified, wants a team trial.",
    signals: [
      { type: "role", value: "Head of Platform, sets standards", at: "00:40" },
      { type: "interest", value: "Project-level isolation per squad", at: "02:02" },
      { type: "question", value: "Org-level usage + billing breakdown?", at: "03:05" },
    ],
    opportunities: ["Provision a team trial", "Demo org usage analytics"],
    decisionMakers: ["Mia Schultz — Head of Platform"],
    followUp: { text: "Provision a team trial; demo org-level usage analytics.", cta: "Start team trial" },
  },
  {
    id: "s11",
    buyer: {
      id: "b11",
      name: "Owen Diaz",
      email: "owen@quantreadhq.com",
      company: "Quantread",
      role: "ML Engineer",
      employees: "11–50",
      industry: "AI agents",
      initials: "QR",
      ...LOGO.indigo,
    },
    scenario: "browserbase",
    startedLabel: "2 days ago",
    dayIndex: 3,
    durationSec: 205,
    device: "Desktop",
    source: "Docs",
    score: 72,
    qualified: false,
    status: "ended",
    summary:
      "Building a research agent. Interested in Stagehand for resilient navigation. Asked about parallel sessions and cold-start latency. Medium-high intent.",
    signals: [
      { type: "interest", value: "Stagehand resilience to DOM changes", at: "01:48" },
      { type: "question", value: "Cold-start latency per session?", at: "02:30" },
    ],
    opportunities: ["Share latency benchmarks + parallel-session guide"],
    decisionMakers: ["Owen Diaz — ML Engineer (champion)"],
    followUp: { text: "Send latency benchmarks and the parallel-sessions guide.", cta: "Send benchmarks" },
  },
  {
    id: "s12",
    buyer: {
      id: "b12",
      name: "Hana Kim",
      email: "hana@settlepay.com",
      company: "SettlePay",
      role: "VP Engineering",
      employees: "201–1,000",
      industry: "Fintech",
      initials: "SP",
      ...LOGO.green,
    },
    scenario: "browserbase",
    startedLabel: "3 days ago",
    dayIndex: 2,
    durationSec: 289,
    device: "Desktop",
    source: "Direct",
    score: 84,
    qualified: true,
    status: "ended",
    summary:
      "Automating bank-portal reconciliation. Heavy focus on security, audit logs, and stealth. Qualified pending a security questionnaire.",
    signals: [
      { type: "role", value: "VP Eng, owns vendor security", at: "00:36" },
      { type: "objection", value: "Requires audit logs + access controls", at: "02:15" },
      { type: "interest", value: "Stealth mode handles bank anti-bot", at: "03:20" },
    ],
    opportunities: ["Send security questionnaire + audit-log docs"],
    decisionMakers: ["Hana Kim — VP Eng"],
    followUp: { text: "Send the security questionnaire and audit-log documentation.", cta: "Send security pack" },
  },
  {
    id: "s13",
    buyer: {
      id: "b13",
      name: "Carlos Mendez",
      email: "carlos@driftkit.dev",
      company: "DriftKit",
      role: "Founder",
      employees: "1–10",
      industry: "Dev tools",
      initials: "DK",
      ...LOGO.amber,
    },
    scenario: "demoless",
    startedLabel: "3 days ago",
    dayIndex: 2,
    durationSec: 176,
    device: "Desktop",
    source: "Docs",
    score: 66,
    qualified: false,
    status: "ended",
    summary:
      "Took the Demoless self-demo to understand the agent before evaluating Browserbase. Curious about how the live-view embed works. Medium intent.",
    signals: [
      { type: "interest", value: "Impressed the agent drove a real product live", at: "01:30" },
      { type: "question", value: "How does the live-view embed work?", at: "02:12" },
    ],
    opportunities: ["Follow up with a Browserbase-specific demo"],
    decisionMakers: ["Carlos Mendez — Founder"],
    followUp: { text: "Book a Browserbase-specific demo.", cta: "Book demo" },
  },
  {
    id: "s14",
    buyer: {
      id: "b14",
      name: "Ivy Chen",
      email: "ivy@latchel.com",
      company: "Latchel",
      role: "CTO",
      employees: "51–200",
      industry: "PropTech",
      initials: "LT",
      ...LOGO.indigo,
    },
    scenario: "browserbase",
    startedLabel: "4 days ago",
    dayIndex: 1,
    durationSec: 231,
    device: "Desktop",
    source: "Direct",
    score: 80,
    qualified: true,
    status: "ended",
    summary:
      "Automating vendor portal workflows. Strong fit for scheduled sessions + Stagehand. Qualified, wants a pilot scoped.",
    signals: [
      { type: "role", value: "CTO, technical + economic buyer", at: "00:30" },
      { type: "interest", value: "Scheduled sessions match their nightly jobs", at: "02:00" },
      { type: "question", value: "Webhook on session completion?", at: "02:45" },
    ],
    opportunities: ["Scope a pilot", "Confirm webhook support"],
    decisionMakers: ["Ivy Chen — CTO"],
    followUp: { text: "Scope a 2-week pilot and confirm webhook support.", cta: "Scope pilot" },
  },
];

// ---- derived aggregates (real, computed from SESSIONS) ----------------------

export function kpis() {
  const total = SESSIONS.length;
  const qualified = SESSIONS.filter((s) => s.qualified).length;
  const avgSec = Math.round(
    SESSIONS.reduce((a, s) => a + s.durationSec, 0) / total
  );
  const highIntent = SESSIONS.filter((s) => intentOf(s.score) === "High").length;
  return {
    total,
    qualified,
    qualifiedPct: Math.round((qualified / total) * 1000) / 10,
    avgLabel: `${Math.floor(avgSec / 60)}m ${String(avgSec % 60).padStart(2, "0")}s`,
    highIntent,
  };
}

export function fmtDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function split<K extends string>(key: (s: Session) => K) {
  const m = new Map<K, number>();
  for (const s of SESSIONS) m.set(key(s), (m.get(key(s)) ?? 0) + 1);
  return [...m.entries()]
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / SESSIONS.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Sessions/qualified bucketed by dayIndex for the timeline chart. */
export function timeline() {
  const days = 9;
  const all = Array(days).fill(0);
  const qual = Array(days).fill(0);
  for (const s of SESSIONS) {
    all[s.dayIndex] += 1;
    if (s.qualified) qual[s.dayIndex] += 1;
  }
  return { all, qual, days };
}

export function getSession(id: string): Session | undefined {
  return SESSIONS.find((s) => s.id === id);
}
export function getBuyerSession(buyerId: string): Session | undefined {
  return SESSIONS.find((s) => s.buyer.id === buyerId);
}

export const SIGNAL_GLYPH: Record<SignalType, { mark: string; cls: string }> = {
  interest: { mark: "+", cls: "int" },
  objection: { mark: "!", cls: "obj" },
  role: { mark: "·", cls: "neu" },
  question: { mark: "?", cls: "neu" },
};
