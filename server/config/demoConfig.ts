// lib/demoConfig.ts is the single source of truth for product content
// (SYSTEM_PROMPT, SECTIONS, GREETING, TARGET). This file wraps it into the
// server's DemoConfig shape used by the brain and orchestrator.
import {
  PRODUCT_NAME,
  SECTIONS,
  SYSTEM_PROMPT,
  type Section,
} from "../../lib/demoConfig";
import {
  CLAY_PRODUCT_NAME,
  CLAY_SECTIONS,
  CLAY_SYSTEM_PROMPT,
  CLAY_TARGET_URL,
} from "../../lib/clayConfig";

/** Configuration for a single demo deployment. */
export interface DemoConfig {
  /** Slug used as the knowledge-base company key (e.g. "browserbase"). */
  company: string;
  /** Human-readable product name for the agent's preamble. */
  productName: string;
  /** Agent persona name (e.g. "Messi"). */
  persona: string;
  /** Starting URL the browser session lands on. */
  browseTargetUrl: string;
  /** Section deep-links the agent navigates to (per product). */
  sections: Section[];
  /** Optional seed text for corpus bootstrapping; may be empty. */
  corpusSeed: string;
  /** Full system prompt from lib/demoConfig (persona + product knowledge).
   *  Optional so test fixtures can omit it; buildSystem falls back to a
   *  generated preamble if absent. */
  systemPrompt?: string;
}

const BROWSERBASE: DemoConfig = {
  company: "browserbase",
  productName: PRODUCT_NAME,
  persona: process.env.DEMO_PERSONA ?? "Messi",
  browseTargetUrl: process.env.DEMO_TARGET_URL ?? "https://www.browserbase.com/",
  sections: SECTIONS,
  corpusSeed: "browserbase",
  systemPrompt: SYSTEM_PROMPT,
};

// Clay runs with the knowledge-base RAG layer OFF (no clay corpus seeded), so
// corpusSeed is "" — searchKnowledge degrades to no hits and the agent grounds
// only on the live page (see lib/clayConfig.ts).
const CLAY: DemoConfig = {
  company: "clay",
  productName: CLAY_PRODUCT_NAME,
  persona: process.env.DEMO_PERSONA ?? "Messi",
  browseTargetUrl: CLAY_TARGET_URL,
  sections: CLAY_SECTIONS,
  corpusSeed: "",
  systemPrompt: CLAY_SYSTEM_PROMPT,
};

const REGISTRY: Record<string, DemoConfig> = {
  browserbase: BROWSERBASE,
  clay: CLAY,
};

export { SECTIONS };

export function getDemoConfig(company = "browserbase"): DemoConfig {
  const cfg = REGISTRY[company];
  if (!cfg) throw new Error(`no DemoConfig for company '${company}'`);
  return cfg;
}
