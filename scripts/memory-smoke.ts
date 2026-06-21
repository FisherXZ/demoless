/**
 * Standalone smoke test for the P4 memory layer (no server required).
 *
 *   docker run -p 6379:6379 redis:7      # or set REDIS_URL to Redis Cloud
 *   npm run memory:smoke
 *
 * Exercises: profile upsert, first vs returning visit, note append + ordering,
 * live Pub/Sub delivery (P4D), and recall composition (P4C).
 */
import {
  upsertProfile,
  loadBuyer,
  remember,
  getNotes,
  createNotesSubscriber,
  buildMemoryContext,
  buyerKey,
  notesKey,
  closeRedis,
  type NoteAddedEvent,
} from "../lib/memory";

const EMAIL = `smoke+${Date.now()}@northwind.co`;

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  ok ? passed++ : failed++;
}

async function main() {
  console.log(`\nBuyer: ${EMAIL}`);
  console.log(`Keys:  ${buyerKey(EMAIL)} | ${notesKey(EMAIL)}\n`);

  // P4D: start the live subscriber before writing any notes.
  const received: NoteAddedEvent[] = [];
  const unsubscribe = await createNotesSubscriber((e) => received.push(e));

  // 1. First visit.
  console.log("1. First visit");
  await upsertProfile(EMAIL, {
    name: "Dana Reed",
    role: "VP of Sales",
    company: "Northwind Co",
    useCase: "Outbound sales",
  });
  const first = await loadBuyer(EMAIL);
  check("visitCount == 1", first.profile.visitCount === 1);
  check("isReturning == false", first.isReturning === false);

  // 2. Remember a few mixed notes.
  console.log("2. Remember notes");
  await remember(EMAIL, {
    type: "interest",
    text: "Salesforce sync",
    importance: 0.9,
    section: "Integrations",
  });
  await remember(EMAIL, {
    type: "pain_point",
    text: "reps burn hours on demos that never convert",
    importance: 0.7,
  });
  await remember(EMAIL, {
    type: "objection",
    text: "worried the AI feels robotic to enterprise buyers",
    importance: 0.6,
  });
  await remember(EMAIL, {
    type: "next_step",
    text: "book a 20-min rollout call with an AE",
    importance: 0.8,
  });
  const notes = await getNotes(EMAIL);
  check("getNotes returns 4 notes", notes.length === 4);
  check(
    "notes are chronological",
    notes.every((n, i) => i === 0 || n.ts >= notes[i - 1].ts)
  );

  // 3. Live delivery (give Pub/Sub a beat to flush).
  console.log("3. Live Pub/Sub (P4D)");
  await new Promise((r) => setTimeout(r, 150));
  check("subscriber received 4 note_added events", received.length === 4);
  check(
    "events carry the buyer key + note text",
    received[0]?.buyerKey === EMAIL.toLowerCase() &&
      received[0]?.note.text === "Salesforce sync"
  );

  // 4. Returning visit + recall (P4C).
  console.log("4. Returning visit (P4C)");
  const second = await loadBuyer(EMAIL);
  check("visitCount == 2", second.profile.visitCount === 2);
  check("isReturning == true", second.isReturning === true);
  check("lastSeen advanced", second.profile.lastSeen >= first.profile.lastSeen);
  check("recall.line is non-empty", second.recall.line.length > 0);
  check(
    "recall mentions top interest",
    second.recall.line.includes("Salesforce sync")
  );

  // 5. Prompt context block (P4B) — eyeball.
  console.log("\n5. buildMemoryContext (P4B):\n");
  console.log(buildMemoryContext(second));
  console.log(`\nRecall line: "${second.recall.line}"`);

  await unsubscribe();
  await closeRedis();

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
