// lib/demoConfig.ts is the single source of truth for product content
// (SYSTEM_PROMPT, SECTIONS, GREETING, TARGET). This file wraps it into the
// server's DemoConfig shape used by the brain and orchestrator.
import {
  PRODUCT_NAME,
  SECTIONS,
  SYSTEM_PROMPT,
} from "../../lib/demoConfig";

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
  corpusSeed: "browserbase",
  systemPrompt: SYSTEM_PROMPT,
};

export { SECTIONS };

export function getDemoConfig(company = "browserbase"): DemoConfig {
  if (company === "browserbase") return BROWSERBASE;
  throw new Error(`no DemoConfig for company '${company}'`);
}
