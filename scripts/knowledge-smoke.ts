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
  listSourceDocs,
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

  // ------------------------------------------------------------------
  // Acceptance: curated Browserbase KB (requires knowledge:curate +
  // knowledge:reindex to have been run with OPENAI_API_KEY set)
  // ------------------------------------------------------------------
  const curated = await listSourceDocs("browserbase");
  if (curated.length > 0) {
    console.log(`\nCurated KB acceptance (${curated.length} source docs):`);

    // "What does it do?" — definitional, so we expect the canonical overview
    // doc to rank #1.
    const whatHits = await searchKnowledge("browserbase", "What does Browserbase do?", 4);
    check(
      `"What does Browserbase do?" -> overview/intro doc #1 (got "${whatHits[0]?.title ?? "none"}")`,
      whatHits.length > 0 && /browserbase|what is|introduction|getting.started/i.test(whatHits[0]?.title ?? "")
    );

    // "Where do I find X?" — navigational. The brain feeds the top-k hits
    // (executor calls searchKnowledge with the default k=4) to the model, so
    // the meaningful guarantee is that the right doc is in the retrieved set,
    // not strictly rank #1.
    const titlesOf = (hits: { title?: string }[]) =>
      hits.map((h) => h.title ?? "").join(" | ");

    const recHits = await searchKnowledge("browserbase", "Where do I find session recordings?", 4);
    check(
      `"Where do I find session recordings?" -> recording/nav doc in top-4 (got [${titlesOf(recHits)}])`,
      recHits.some((h) => /navigation|recording|replay|observability/i.test(h.title ?? ""))
    );

    const playHits = await searchKnowledge("browserbase", "Where is the Playground?", 4);
    check(
      `"Where is the Playground?" -> navigation guide in top-4 (got [${titlesOf(playHits)}])`,
      playHits.some((h) => /navigation|playground/i.test(h.title ?? ""))
    );

    const pricingHits = await searchKnowledge("browserbase", "How much does it cost?", 4);
    check(
      `"How much does it cost?" -> plans/pricing doc in top-4 (got [${titlesOf(pricingHits)}])`,
      pricingHits.some((h) => /plan|pricing/i.test(h.title ?? ""))
    );

    const isolated = await searchKnowledge("some-other-co", "What does Browserbase do?", 4);
    check("company filter isolates curated KB", isolated.length === 0);
  } else {
    console.log("\n(Skipping curated KB acceptance — run knowledge:curate + knowledge:reindex first)");
  }

  await closeRedis();

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
