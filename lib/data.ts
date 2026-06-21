import type { Lead } from "./types";

export const SECTIONS = [
  "Overview",
  "Live demos",
  "Pricing",
  "Integrations",
  "Security",
  "ROI",
  "Customer proof",
  "Get started",
];

export const CAPTIONS = [
  "Hey! I'm Maya. I'll walk you through Browserbase in about three minutes. Let's start with the big picture.",
  "This is your Browserbase dashboard, every cloud browser your agents run shows up here, with usage at a glance.",
  "Open Sessions and you get the full picture of any run, a live view, network logs, and a replay you can scrub through.",
  "The Playground lets you spin up a real cloud browser in one click and try it live, no setup.",
  "Under the hood it's built for the whole web, stealth mode, residential proxies, and persistent contexts so logins just stick.",
  "And it scales, thousands of concurrent browsers with sub-second starts, so your agents never wait.",
  "Pricing scales with usage, not seats, so you only pay for the browser time you actually run.",
  "That's the tour. Want to keep going?",
];

export const PIPELINE = [
  "New",
  "Qualified",
  "Trial Started",
  "Needs Human",
  "Closed",
];

export const STAGE_COLOR: Record<string, string> = {
  New: "#94a3b8",
  Qualified: "#4f46e5",
  "Trial Started": "#15803d",
  "Needs Human": "#b45309",
  Closed: "#1c1c1a",
};

export const LEADS: Lead[] = [
  {
    id: "l1",
    company: "Northwind Co",
    initials: "NW",
    logoBg: "#eef0ff",
    logoColor: "#4338ca",
    role: "VP of Sales",
    size: "201–1,000",
    useCase: "Outbound sales",
    score: 88,
    intent: 86,
    stage: "Qualified",
    painPoints: [
      "Reps burn hours on demos that never convert",
      "No visibility into what buyers actually care about",
    ],
    objections: [
      "Worried the AI feels robotic to enterprise buyers",
      "Needs Salesforce to be the source of truth",
    ],
    viewed: [1, 1, 1, 1, 1, 1, 1, 0],
    summary:
      "Strong fit. VP Sales joined from an outbound email, watched the full walkthrough and lingered on ROI and integrations. Asked twice about Salesforce sync. High intent, ready for an AE conversation on rollout, not on whether to buy.",
    followUp:
      "Send the Salesforce sync one-pager and offer a 20-min rollout call with an AE this week.",
    followUpCta: "Send sync brief + book AE",
  },
  {
    id: "l2",
    company: "Cadence Labs",
    initials: "CL",
    logoBg: "#e7f6ec",
    logoColor: "#15803d",
    role: "RevOps",
    size: "51–200",
    useCase: "Inbound / PLG conversion",
    score: 81,
    intent: 78,
    stage: "Qualified",
    painPoints: [
      "Inbound trials stall without a guided demo",
      "AEs spend nights doing repeat PLG demos",
    ],
    objections: ["Unsure how it handles deep product questions"],
    viewed: [1, 1, 1, 1, 0, 1, 1, 1],
    summary:
      "RevOps lead exploring PLG conversion. Engaged heavily with the live-demos feature and ROI. Skipped security. Clear buying signal, wants to self-serve a trial before looping in budget owner.",
    followUp:
      "Trigger trial provisioning and send the PLG playbook. Nudge to invite their VP Sales.",
    followUpCta: "Start trial + send playbook",
  },
  {
    id: "l3",
    company: "Verite",
    initials: "VR",
    logoBg: "#fcf3e6",
    logoColor: "#b45309",
    role: "Founder / CEO",
    size: "11–50",
    useCase: "Inbound / PLG conversion",
    score: 63,
    intent: 54,
    stage: "New",
    painPoints: [
      "Founder-led sales doesn’t scale",
      "No time to demo every inbound lead",
    ],
    objections: [
      "Price sensitivity at current stage",
      "Wants to know if it works for a technical product",
    ],
    viewed: [1, 1, 1, 0, 0, 0, 1, 0],
    summary:
      "Early-stage founder, exploratory. Watched overview, live demos and pricing then dropped off. Medium-low intent, curious but not yet urgent. Good nurture candidate.",
    followUp:
      "Add to founder nurture sequence; share the Starter (free) tier and a customer story from a similar-stage team.",
    followUpCta: "Add to nurture sequence",
  },
  {
    id: "l4",
    company: "Loop HQ",
    initials: "LH",
    logoBg: "#e7f6ec",
    logoColor: "#15803d",
    role: "Marketing",
    size: "201–1,000",
    useCase: "Partner & channel demos",
    score: 90,
    intent: 91,
    stage: "Trial Started",
    painPoints: [
      "Channel partners need consistent demos",
      "Hard to keep partner reps on-message",
    ],
    objections: [],
    viewed: [1, 1, 1, 1, 1, 1, 1, 1],
    summary:
      "Excellent fit. Marketing lead completed the entire walkthrough including the convert step and started a trial on the spot. No objections raised. Highest-intent lead this week.",
    followUp:
      "Trial is live, assign a CSM for white-glove onboarding and schedule a 30-day check-in.",
    followUpCta: "Assign CSM",
  },
  {
    id: "l5",
    company: "Mistral Retail",
    initials: "MR",
    logoBg: "#eef0ff",
    logoColor: "#4338ca",
    role: "IT / Security",
    size: "1,000+",
    useCase: "Outbound sales",
    score: 72,
    intent: 68,
    stage: "Needs Human",
    needsHuman: true,
    painPoints: [
      "Security review required before any pilot",
      "Concerned about buyer data handling",
    ],
    objections: [
      "Needs SOC 2 report and DPA before proceeding",
      "Wants EU data residency confirmed",
    ],
    viewed: [1, 0, 0, 1, 1, 0, 0, 0],
    summary:
      "IT/Security stakeholder. Focused almost entirely on the security section and asked detailed compliance questions the AI flagged for human handoff. Real opportunity but gated on a security review.",
    followUp:
      "Route to an AE + solutions engineer. Send SOC 2 Type II report, DPA, and EU residency confirmation.",
    followUpCta: "Route to AE + SE",
  },
  {
    id: "l6",
    company: "Brightwave",
    initials: "BW",
    logoBg: "#fcf3e6",
    logoColor: "#b45309",
    role: "Sales / RevOps",
    size: "51–200",
    useCase: "Outbound sales",
    score: 58,
    intent: 44,
    stage: "New",
    painPoints: ["Demo no-show rate is high"],
    objections: ["Not sure buyers will trust an AI rep"],
    viewed: [1, 1, 0, 0, 0, 0, 0, 0],
    summary:
      "Brief session. Watched overview and live demos then left early. Low intent for now, likely top-of-funnel research.",
    followUp: "Add to long-term nurture; retarget with a customer-proof case study.",
    followUpCta: "Add to nurture sequence",
  },
  {
    id: "l7",
    company: "Atlas Freight",
    initials: "AF",
    logoBg: "#e7f6ec",
    logoColor: "#15803d",
    role: "VP of Sales",
    size: "1,000+",
    useCase: "Outbound sales",
    score: 84,
    intent: 80,
    stage: "Trial Started",
    painPoints: [
      "Long sales cycles, expensive AE time",
      "Inconsistent demo quality across reps",
    ],
    objections: ["Wants to confirm CRM data hygiene"],
    viewed: [1, 1, 1, 1, 1, 1, 1, 1],
    summary:
      "Enterprise VP Sales, full walkthrough completed and trial started. One light objection on CRM hygiene. Strong expansion potential across multiple regions.",
    followUp:
      "Trial live, schedule an exec business review and map a multi-region rollout.",
    followUpCta: "Book exec review",
  },
  {
    id: "l8",
    company: "Verdant",
    initials: "VD",
    logoBg: "#eef0ff",
    logoColor: "#4338ca",
    role: "Founder / CEO",
    size: "11–50",
    useCase: "Inbound / PLG conversion",
    score: 93,
    intent: 95,
    stage: "Closed",
    closed: true,
    painPoints: ["Needed instant demos for inbound surge"],
    objections: [],
    viewed: [1, 1, 1, 1, 1, 1, 1, 1],
    summary:
      "Closed-won. Founder ran the full demo, started a trial the same day and converted to Growth within the week. Reference-able.",
    followUp:
      "Onboarding complete, request a logo + quote for the customers page.",
    followUpCta: "Request reference quote",
  },
];

export function scoreColor(n: number): string {
  return n >= 80 ? "#15803d" : n >= 65 ? "#4338ca" : "#b45309";
}

export function intentMeta(n: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (n >= 75) return { label: "High", color: "#15803d", bg: "#e7f6ec" };
  if (n >= 55) return { label: "Medium", color: "#b45309", bg: "#fcf3e6" };
  return { label: "Low", color: "#78716c", bg: "#f3f2f0" };
}
