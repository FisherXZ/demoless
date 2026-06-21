// Standalone driver — no ws, no frontend. Run: `npm run smoke` (USE_STUB=1 for
// no API key). Proves greet → chat → memory capture → welcome-back.

import { Loop } from "./loop";
import { registerVoiceFake } from "./fakes/voice";
import { registerBrowserFake } from "./fakes/browser";
import { registerMemoryFake, loadBuyer } from "./fakes/memory";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function session(buyerId: string, lines: string[]) {
  const loop = new Loop(`sess-${buyerId}-${lines.length}`, buyerId);
  registerVoiceFake(loop);
  registerBrowserFake(loop);
  registerMemoryFake(loop, buyerId);
  loop.start(); // greet
  await sleep(50);
  for (const line of lines) {
    console.log(`\n  🧑 USER: ${line}`);
    loop.send({ kind: "user_said", text: line, final: true });
    await sleep(50);
  }
}

export async function runSmoke(buyerId = "smoke-user") {
  console.log("=== Session 1 (new visitor) ===");
  await session(buyerId, ["we waste hours prepping demos and can't measure results"]);
  console.log("\n  📝 stored notes:", loadBuyer(buyerId).notes.map((n) => `${n.type}:${n.value}`));
  console.log("\n=== Session 2 (returning) ===");
  await session(buyerId, []); // greet only — should welcome back
}

/* v8 ignore next 3 -- CLI entrypoint exits the process; runSmoke is covered directly. */
if (process.argv[1] && process.argv[1].endsWith("smoke.ts")) {
  runSmoke().then(() => process.exit(0));
}
