// Rule-based audience personas. Maps the visitor's self-reported role (from the
// pre-call form) to a short instruction block appended to the system prompt, so
// the agent tailors its tone: precise/technical for builders, plain-language and
// business-outcome-focused for everyone else. Pure + isomorphic (no Node/DOM).

export type Persona = "technical" | "nontechnical";

/**
 * Role keywords that mark a TECHNICAL audience. Matched as whole words
 * (case-insensitive), except multi-word phrases which match as substrings.
 * Note: "operations"/"ops" is deliberately NON-technical, while "devops" (a
 * single token here) is technical.
 */
const TECHNICAL_KEYWORDS = [
  "engineer",
  "engineering",
  "developer",
  "dev",
  "devops",
  "programmer",
  "coder",
  "software",
  "swe",
  "architect",
  "sre",
  "sysadmin",
  "it",
  "security",
  "infosec",
  "data",
  "ml",
  "ai",
  "technical",
  "technologist",
  "cto",
  "platform",
  "infrastructure",
  "backend",
  "frontend",
  "fullstack",
  "full-stack",
  "qa",
  "machine learning",
  "solutions engineer",
  "sales engineer",
];

/**
 * Classify a visitor from their free-text/role label. Defaults to "nontechnical"
 * when the role is missing or matches nothing, so explanations stay accessible.
 */
export function detectPersona(role?: string | null): Persona {
  if (!role) return "nontechnical";
  const text = role.toLowerCase();
  const tokens = new Set(text.split(/[^a-z0-9+]+/).filter(Boolean));
  for (const kw of TECHNICAL_KEYWORDS) {
    if (kw.includes(" ") || kw.includes("-")) {
      if (text.includes(kw)) return "technical";
    } else if (tokens.has(kw)) {
      return "technical";
    }
  }
  return "nontechnical";
}

const TECHNICAL_INSTRUCTION =
  "Audience: this visitor is technical (e.g. engineer, developer, IT/security). " +
  "Use precise technical language — APIs, architecture, integrations, performance — " +
  "and assume fluency with software concepts, so skip basic explanations. " +
  "Keep replies concise: 1-2 short spoken sentences.";

const NONTECHNICAL_INSTRUCTION =
  "Audience: this visitor is non-technical (e.g. sales, operations, marketing, founder). " +
  "Explain in plain language focused on business value and outcomes; avoid jargon and " +
  "acronyms, or define them in a few words with a simple analogy. " +
  "Keep replies concise: 1-2 short spoken sentences.";

/** The persona instruction text for an already-classified persona. */
export function personaInstruction(persona: Persona): string {
  return persona === "technical"
    ? TECHNICAL_INSTRUCTION
    : NONTECHNICAL_INSTRUCTION;
}

/** Convenience: classify a role and return its instruction block in one step. */
export function personaBlock(role?: string | null): string {
  return personaInstruction(detectPersona(role));
}
