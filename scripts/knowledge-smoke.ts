/**
 * Standalone smoke test for the product-knowledge RAG layer.
 *
 *   docker run -p 6379:6379 redis/redis-stack:latest   # needs Redis Stack (FT.*)
 *   OPENAI_API_KEY=sk-...  npm run knowledge:smoke
 *
 * Proves semantic retrieval works: a paraphrased question (no keyword overlap)
 * still pulls the right document. Uses its own company slug so it never touches
 * the real seed corpus.
 */
import {
  indexDocuments,
  searchKnowledge,
  clearKnowledge,
  buildAnswerContext,
  closeRedis,
  type KnowledgeDoc,
} from "../lib/knowledge";

const COMPANY = "demoless-smoke";

const DOCS: KnowledgeDoc[] = [
  {
    id: "pricing",
    title: "Pricing",
    text: "Plans scale with demos, not seats. Starter is free with 50 demos a month; Growth is $1,200 per month for unlimited demos and CRM sync; Enterprise is custom.",
  },
  {
    id: "integrations",
    title: "Integrations",
    text: "Connects to your CRM and tools: Salesforce and HubSpot sync leads, Slack posts notifications, Segment streams analytics, and Zapier reaches 5,000+ apps.",
  },
  {
    id: "security",
    title: "Security",
    text: "Enterprise-grade by default: SOC 2 Type II certified, SSO and SAML via Okta and Azure AD, GDPR compliant with a DPA, and encryption at rest and in transit.",
  },
];

// Paraphrased questions (deliberately little keyword overlap) -> expected doc.
const CASES: { q: string; expect: string }[] = [
  { q: "Will it push my leads into our Salesforce CRM automatically?", expect: "Integrations" },
  { q: "Are you compliant for handling enterprise customer data?", expect: "Security" },
  { q: "What does it cost per month?", expect: "Pricing" },
];

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  ok ? passed++ : failed++;
}

async function main() {
  console.log(`\nCompany: ${COMPANY}\n`);

  await clearKnowledge(COMPANY);
  const n = await indexDocuments(COMPANY, DOCS);
  check(`indexed chunks from ${DOCS.length} docs`, n >= DOCS.length);

  console.log("\nSemantic retrieval:");
  for (const { q, expect } of CASES) {
    const hits = await searchKnowledge(COMPANY, q, 3);
    const top = hits[0];
    check(
      `"${q}" -> ${expect} (got ${top?.title ?? "none"}, score ${top?.score.toFixed(3) ?? "-"})`,
      top?.title === expect
    );
  }

  // Wrong-company filter must return nothing.
  const isolated = await searchKnowledge("some-other-co", CASES[0].q, 3);
  check("company filter isolates results", isolated.length === 0);

  console.log("\nbuildAnswerContext for the integrations question:\n");
  const ctxHits = await searchKnowledge(COMPANY, CASES[0].q, 2);
  console.log(buildAnswerContext(ctxHits));

  await clearKnowledge(COMPANY);
  await closeRedis();

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
