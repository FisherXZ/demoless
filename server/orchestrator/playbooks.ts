import type { Section } from "../../lib/demoConfig";
import { wantsProductDemo } from "./intent";

export type PlaybookStep =
  | { action: "navigate"; url: string }
  | { action: "click"; text: string }
  | { action: "look" }
  | { action: "set_phase"; phase: "WALKTHROUGH" };

export interface MatchedPlaybook {
  id: string;
  directive: string;
  /** Spoken immediately — before browser steps — so the visitor never waits in silence. */
  opening: string;
  /** Spoken if the model is still silent 1s after the playbook finishes. */
  followup?: string;
  steps: PlaybookStep[];
}

const SHOW_PRODUCT_DIRECTIVE =
  "\n\nCRITICAL THIS TURN: The visitor asked to see the product or its features. You already navigated to the Overview dashboard and spoke an opening line. Add at most ONE short new sentence only if the screen shows something worth naming — otherwise stay silent (tools only). Do NOT ask discovery questions.";

const SEC_FILING_DIRECTIVE =
  "\n\nCRITICAL THIS TURN: The visitor asked to extract SEC filings. You already opened the Playground, ran the SEC template, and spoke an opening line. Add at most ONE short new sentence only if the screen shows something new — otherwise stay silent (tools only). Do NOT ask discovery questions or describe your clicks.";

/** True when the visitor wants an SEC filing extraction demo in the Playground. */
export function wantsSecFilingDemo(text: string): boolean {
  const lower = text.toLowerCase().replace(/['']/g, "'").trim();
  if (!lower) return false;
  return (
    /\bsec\b.*\bfil|\bfil(?:ing|e|ings)?\b.*\bsec\b|\bextract\b.*\bsec\b|\bsec\s+filing/i.test(
      lower
    ) || /\bextract\s+sec\s+filing/i.test(lower)
  );
}

export function matchPlaybook(text: string, sections: Section[]): MatchedPlaybook | null {
  if (wantsSecFilingDemo(text)) {
    const playground = sections.find((s) => s.label === "Playground");
    if (!playground) return null;
    return {
      id: "sec-filing",
      directive: SEC_FILING_DIRECTIVE,
      opening: "EDGAR filings by ticker or CIK — running in the cloud.",
      followup: "Every run gets a replay and full session logs.",
      steps: [
        { action: "navigate", url: playground.url },
        { action: "click", text: "Extract SEC filing data" },
        { action: "look" },
        { action: "click", text: "Run script" },
        { action: "set_phase", phase: "WALKTHROUGH" },
      ],
    };
  }

  if (wantsProductDemo(text)) {
    const overview = sections.find((s) => s.label === "Overview");
    if (!overview) return null;
    return {
      id: "product-tour",
      directive: SHOW_PRODUCT_DIRECTIVE,
      opening: "Cloud browsers your agents drive — here's your dashboard.",
      followup: "Every session shows up here with usage at a glance.",
      steps: [
        { action: "navigate", url: overview.url },
        { action: "set_phase", phase: "WALKTHROUGH" },
      ],
    };
  }

  return null;
}
