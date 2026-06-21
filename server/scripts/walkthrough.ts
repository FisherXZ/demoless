// CLI walkthrough driver — connects to the LIVE agent on ws://localhost:8787,
// sends a scripted customer (Jordan, VP Sales @ Acme, evaluating Demoless) one
// turn at a time, waits for each turn (incl. its page-load narration) to
// settle, and logs the agent's real say/navigate/remember + phase/tour/notes.
//
// Run the orchestrator first (npm run server), then: npx tsx server/scripts/walkthrough.ts

import { WebSocket } from "ws";
import type { ServerMsg } from "../../shared/wire";

const URL = process.env.WS_URL ?? "ws://localhost:8787";
const BUYER = process.env.BUYER ?? `cli-jordan-${process.pid}`;
const QUIET_MS = 6000; // advance only after a turn completed AND this much silence

// Visit 1 — the customer lines (the agent supplies HOOK/discovery/walkthrough/close)
const SCRIPT: string[] = [
  "Yeah, we run a ton of demos — my team does maybe 30 a week.",
  "Prepping mostly. And honestly they all feel generic — same deck to everyone.",
  "No, we don't really measure it. We just guess from the rep's notes afterward.",
  "How does it personalize for each prospect without me setting all that up?",
  "Okay, show me the part where I can see what prospects actually engaged with.",
  "What's pricing like?",
  "Makes sense — this could work for us.",
];

const ws = new WebSocket(URL);
const send = (m: object) => ws.send(JSON.stringify(m));
let step = 0;
let phase = "?";
let visit = 1;
let gotTurn = false; // a server `turn` snapshot arrived since the last send
let quietTimer: NodeJS.Timeout | null = null;

const log = (line: string) => process.stdout.write(line + "\n");

function render(m: ServerMsg) {
  switch (m.t) {
    case "command":
      if (m.cmd.kind === "say") log(`  🤖 AGENT: ${m.cmd.text}`);
      else if (m.cmd.kind === "navigate") log(`     ↳ navigate → ${m.cmd.target}`);
      else if (m.cmd.kind === "click_or_type") log(`     ↳ act: ${m.cmd.instruction}`);
      else if (m.cmd.kind === "remember") log(`     ↳ 📝 ${m.cmd.note.type}: "${m.cmd.note.value}"`);
      break;
    case "turn": {
      phase = m.snapshot.phase ?? phase;
      const tour = m.snapshot.currentStep ? `#${m.snapshot.tourIndex} ${m.snapshot.currentStep}` : "—";
      const notes = m.snapshot.buyer?.notes?.map((n) => n.type).join(",") || "none";
      log(`     · [phase=${phase} tour=${tour} notes=${notes}]`);
      break;
    }
    case "error":
      log(`  ⚠️  ERROR: ${m.message}`);
      break;
    case "incoming":
      if (m.msg.kind === "screen_is_on") log(`     · screen: ${m.msg.summary}`);
      break;
  }
}

function armQuiet() {
  if (quietTimer) clearTimeout(quietTimer);
  quietTimer = setTimeout(onQuiet, QUIET_MS);
}

function onQuiet() {
  if (!gotTurn) { armQuiet(); return; } // turn still in flight — keep waiting
  next();
}

function next() {
  gotTurn = false;
  if (visit === 1) {
    if (step < SCRIPT.length) {
      const line = SCRIPT[step++];
      log(`\n🧑 JORDAN: ${line}`);
      send({ t: "user_said", text: line, final: true });
      armQuiet();
      return;
    }
    visit = 2;
    log(`\n———— RETURN VISIT (same buyer, no wipe) ————`);
    send({ t: "reset", wipeBuyer: false });
    armQuiet();
    return;
  }
  if (visit === 2) {
    visit = 3;
    log(`\n🔁 (re-opening demo as returning buyer)`);
    send({ t: "start", buyerId: BUYER });
    armQuiet();
    return;
  }
  log(`\n✅ walkthrough complete.`);
  ws.close();
}

ws.on("open", () => {
  log(`connected ${URL} as buyer=${BUYER}`);
  log(`\n———— VISIT 1 (new prospect) ————`);
  send({ t: "start", buyerId: BUYER });
  armQuiet();
});
ws.on("message", (raw) => {
  const m = JSON.parse(raw.toString()) as ServerMsg;
  render(m);
  if (m.t === "turn") gotTurn = true;
  armQuiet();
});
ws.on("error", (e) => log(`socket error: ${(e as Error).message}`));
ws.on("close", () => process.exit(0));
