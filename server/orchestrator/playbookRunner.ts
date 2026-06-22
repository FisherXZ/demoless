import type { Command } from "../../lib/voice/messages";
import type { ToolExecutor } from "../brain/executor";
import type { MatchedPlaybook, PlaybookStep } from "./playbooks";
import { toText } from "../util/contentText";

function pageLabel(content: string, fallback: string): string {
  const titleMatch = content.match(/^Title: (.+)$/m);
  const urlMatch = content.match(/^URL: (.+)$/m);
  return titleMatch?.[1]?.trim() || urlMatch?.[1]?.trim() || fallback;
}

async function runStep(
  step: PlaybookStep,
  executor: ToolExecutor,
  signal: AbortSignal
): Promise<{ commands: Command[]; content: string }> {
  // toText at the boundary: a failed playbook click could now return a
  // [text, image] array, so collapse to string before the label regex.
  if (step.action === "navigate") {
    const r = await executor.run("navigate", { url: step.url }, signal);
    const content = toText(r.content);
    return {
      commands: [
        { type: "navigate", url: step.url },
        { type: "screen_is_on", page: pageLabel(content, step.url) },
      ],
      content,
    };
  }
  if (step.action === "click") {
    const r = await executor.run("click", { text: step.text }, signal);
    const content = toText(r.content);
    return {
      commands: [{ type: "screen_is_on", page: pageLabel(content, step.text) }],
      content,
    };
  }
  if (step.action === "look") {
    const r = await executor.run("look", {}, signal);
    return { commands: [], content: toText(r.content) };
  }
  await executor.run("set_phase", { phase: step.phase }, signal);
  return { commands: [{ type: "set_phase", phase: step.phase }], content: "" };
}

/** Execute deterministic browser steps before the LLM turn. */
export async function* runPlaybook(
  playbook: MatchedPlaybook,
  executor: ToolExecutor,
  signal: AbortSignal
): AsyncIterable<Command> {
  for (const step of playbook.steps) {
    if (signal.aborted) return;
    const { commands } = await runStep(step, executor, signal);
    for (const cmd of commands) yield cmd;
  }
}
