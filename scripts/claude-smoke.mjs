// Quick check that the Anthropic key works on a fast model.
// Run: node --env-file=.env.local scripts/claude-smoke.mjs
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const t0 = Date.now();
const msg = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 100,
  messages: [{ role: "user", content: "Reply with exactly: agent online" }],
});
console.log("model  :", msg.model);
console.log("reply  :", msg.content.find((b) => b.type === "text")?.text);
console.log("latency:", Date.now() - t0, "ms");
