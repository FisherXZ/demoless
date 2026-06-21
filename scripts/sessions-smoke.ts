/**
 * Standalone smoke test for the post-session recap layer.
 *
 *   docker run -p 6379:6379 redis:7      # or set REDIS_URL
 *   npm run sessions:smoke
 *
 * Exercises: record -> persist -> analyze (fake model) -> grounding drops a
 * hallucinated insight -> recap round-trip -> dashboard index. No API key needed.
 */
import {
  SessionRecorder,
  analyzeAndStore,
  saveSession,
  loadSession,
  loadRecap,
  listSessions,
  sessionKey,
  recapKey,
} from "../lib/sessions";
import { getRedis, closeRedis } from "../lib/memory";

const ID = `smoke-${Date.now()}`;
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  ok ? passed++ : failed++;
}

const fakeChat = async () =>
  JSON.stringify({
    label: "follow_up_needed",
    labelEvidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }],
    summary: "Buyer asked about pricing and integrations.",
    whyTheyCame: { text: "evaluating cost", evidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }] },
    buyingSignals: [
      { text: "asked about pricing", evidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }] },
      { text: "claimed budget (hallucinated)", evidence: [{ kind: "quote", speaker: "user", text: "we have a huge budget" }] },
    ],
    objectionsQuestions: [],
    gaps: [],
    nextAction: { text: "send pricing", evidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }] },
    draftEmail: { subject: "Pricing", body: "Hi..." },
  });

async function main() {
  const r = new SessionRecorder(Date.now());
  r.recordUser("what does it cost", 1);
  r.recordPage("https://acme.com/pricing", 1);
  r.recordAgent("It's $99 per seat.", 1);
  const record = r.build({
    id: ID,
    company: "Acme",
    status: "ended",
    createdAt: Date.now(),
    role: "Engineer",
    phaseReached: "WALKTHROUGH",
  });

  await saveSession(record);
  check("session persisted", (await loadSession(ID))?.id === ID);

  await analyzeAndStore(record, fakeChat);
  const { status, recap } = await loadRecap(ID);
  check("recap ready", status === "ready" && !!recap);
  check("grounding dropped the hallucinated signal", recap!.buyingSignals.length === 1);
  check("label is follow_up_needed", recap!.label === "follow_up_needed");

  const list = await listSessions();
  check("session appears in dashboard index with label", list.some((s) => s.id === ID && s.label === "follow_up_needed"));

  await getRedis().del(sessionKey(ID), recapKey(ID));
  await getRedis().zrem("demoless:sessions", ID);
  await closeRedis();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
