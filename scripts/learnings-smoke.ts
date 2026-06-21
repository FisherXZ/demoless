/**
 * Standalone smoke test for the cross-session demo-learnings layer.
 *
 *   docker run -p 6379:6379 redis:7      # or set REDIS_URL
 *   npm run learnings:smoke
 *
 * Exercises: write -> read round-trip, ranked top-K formatting, lenient
 * reflection parsing (with a fake model so no API key is needed).
 */
import {
  writeLearnings,
  getLearnings,
  buildLearningsContext,
  reflectOnSession,
  learningsKey,
} from "../lib/learnings";
import { getRedis, closeRedis } from "../lib/memory";

const COMPANY = `smoke-${Date.now()}`;

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  ok ? passed++ : failed++;
}

async function main() {
  // 1. write -> read round-trip
  await writeLearnings(COMPANY, [
    { text: "Show ROI before features", confidence: 0.9 },
    { text: "Open the compliance page on security objections", confidence: 0.6 },
  ]);
  const all = await getLearnings(COMPANY);
  check("two learnings persisted", all.length === 2);

  // 2. ranked top-K formatting (higher confidence first)
  const block = buildLearningsContext(all, 5);
  check("context block non-empty", block.includes("Past demo learnings"));
  check(
    "highest-confidence learning ranked first",
    block.indexOf("Show ROI") < block.indexOf("compliance page")
  );

  // 3. reflection parsing with a fake model (no API key needed)
  const fakeChat = async () =>
    '[{"text":"Ask about team size early","confidence":0.7}]';
  const distilled = await reflectOnSession(
    [
      { role: "user", text: "we are a 200 person team" },
      { role: "agent", text: "great, here is the enterprise view" },
    ],
    "DISCOVERY",
    fakeChat
  );
  check("reflection parsed one learning", distilled.length === 1);

  // cleanup
  await getRedis().del(learningsKey(COMPANY));
  await closeRedis();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
