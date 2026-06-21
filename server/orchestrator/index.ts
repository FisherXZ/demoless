import type { Orchestrator } from "./types";
import { StubOrchestrator } from "./stub";

/**
 * Single place P2 constructs the orchestrator. When P1's real LLM loop lands,
 * swap the implementation here (or branch on an env flag) - nothing else in
 * the voice layer needs to change.
 */
export function createOrchestrator(): Orchestrator {
  return new StubOrchestrator();
}

export type { Orchestrator } from "./types";
