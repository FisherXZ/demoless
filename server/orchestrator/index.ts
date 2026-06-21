import type { Orchestrator } from "./types";
import { LoopOrchestrator } from "./loop";
import { makeExecutor } from "../brain/executor";
import { getDemoConfig } from "../config/demoConfig";
import * as browser from "../../lib/browser/session";
import { remember } from "../../lib/memory/store";
import { searchKnowledge } from "../../lib/knowledge/store";
import { buildAnswerContext } from "../../lib/knowledge/answer";

export function createOrchestrator(args: {
  sessionId: string;
  buyerId: string;
  company: string;
}): Orchestrator {
  const cfg = getDemoConfig(args.company);
  const executor = makeExecutor({
    sessionId: args.sessionId,
    buyerId: args.buyerId,
    company: cfg.company,
    browser,
    memory: { remember },
    knowledge: { searchKnowledge, buildAnswerContext },
  });
  return new LoopOrchestrator({ executor, cfg });
}

export type { Orchestrator } from "./types";
