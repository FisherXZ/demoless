/** Configuration for a single demo deployment. */
export interface DemoConfig {
  /** Slug used as the knowledge-base company key (e.g. "browserbase"). */
  company: string;
  /** Human-readable product name for the agent's preamble. */
  productName: string;
  /** Agent persona name (e.g. "Maya"). */
  persona: string;
  /** Starting URL the browser session lands on. */
  browseTargetUrl: string;
  /** Optional seed text for corpus bootstrapping; may be empty. */
  corpusSeed: string;
}
