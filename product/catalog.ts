// Tagged Browserbase demo-step catalog. DISCOVERY filters this into the
// walkthrough subset, then the browser lane maps each semantic target to the
// real Browserbase dashboard or docs location it can reliably drive.

export interface DemoStep {
  id: string;
  addresses: string[]; // pain phrases this step speaks to
  navigate: string; // target the agent navigates to
  say: string; // talking point
}

export const CATALOG: DemoStep[] = [
  {
    id: "sessions",
    addresses: [
      "browser infrastructure",
      "self-hosted chromium",
      "scaling browsers",
      "automation reliability",
      "agent browsing",
    ],
    navigate: "browserbase sessions",
    say:
      "Browserbase gives your agent a managed cloud browser session instead of forcing you to operate Chromium yourself.",
  },
  {
    id: "live-view",
    addresses: [
      "debugging",
      "watch the agent",
      "observability",
      "what happened",
      "customer trust",
    ],
    navigate: "browserbase session live view",
    say:
      "Live View lets you watch and control the browser in real time, which is exactly what we embed for the prospect.",
  },
  {
    id: "contexts",
    addresses: [
      "login",
      "authentication",
      "cookies",
      "persistent sessions",
      "repeat workflows",
    ],
    navigate: "browserbase contexts",
    say:
      "Contexts persist cookies, auth tokens, and browser storage so the agent can stay logged in across sessions.",
  },
  {
    id: "stagehand",
    addresses: [
      "natural language actions",
      "selector brittleness",
      "page changes",
      "ai browser control",
      "data extraction",
    ],
    navigate: "browserbase stagehand",
    say:
      "Stagehand mixes Playwright-style control with AI actions and extraction, so the agent can handle pages that shift under it.",
  },
  {
    id: "security",
    addresses: [
      "security",
      "compliance",
      "sensitive data",
      "recording controls",
      "regulated workloads",
    ],
    navigate: "browserbase security",
    say:
      "For sensitive workflows, Browserbase supports controls like disabled logs and recordings, ZDR, BYOS, regions, and enterprise compliance.",
  },
];
