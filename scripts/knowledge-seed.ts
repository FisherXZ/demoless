/**
 * Seed the product-knowledge index with a sample corpus (the Demoless product
 * itself — mirrors the copy shown in components/DemoRoom.tsx). This is the
 * "what does the product do" content the AI rep answers buyer questions from.
 *
 *   docker run -p 6379:6379 redis/redis-stack:latest
 *   OPENAI_API_KEY=sk-...  npm run knowledge:seed
 *
 * indexDocuments() is generic, so local files or a P3 crawl can feed it later;
 * this script just provides ready-to-demo content.
 */
import { indexDocuments, clearKnowledge, closeRedis } from "../lib/knowledge";
import type { KnowledgeDoc } from "../lib/knowledge";

export const SEED_COMPANY = "demoless";

export const SEED_DOCS: KnowledgeDoc[] = [
  {
    id: "overview",
    title: "Overview",
    source: "demoless.com",
    text: `Demoless is an AI sales engineer that runs live product demos 24/7. Visitors click once and join a live, Google Meet-style call where an AI rep screen-shares the product and walks them through it by voice. No scheduling, no calendar back-and-forth — the buyer is inside the product within seconds. The walkthrough is tailored by role: a VP of Sales and an IT lead see different paths, features, security, and ROI that match them.`,
  },
  {
    id: "pricing",
    title: "Pricing",
    source: "demoless.com/pricing",
    text: `Pricing scales with demos, not seats. Starter is free and includes 50 AI demos per month. Growth is $1,200/month for unlimited demos plus CRM sync, and is the recommended plan for most teams. Enterprise is custom-priced and adds SSO, an SLA, and data residency options. There is no per-seat charge on any plan.`,
  },
  {
    id: "integrations",
    title: "Integrations",
    source: "demoless.com/integrations",
    text: `Demoless drops into your existing stack. Leads and call data sync the moment a demo ends. Native integrations include Salesforce and HubSpot for CRM, Slack for notifications, and Segment for analytics. Zapier connects Demoless to 5,000+ other apps, and Gmail is supported for follow-up. Most integrations are one click; Salesforce sync is bi-directional.`,
  },
  {
    id: "security",
    title: "Security",
    source: "demoless.com/security",
    text: `Demoless is enterprise-grade by default because the AI rep talks to real buyers. It is SOC 2 Type II certified, audited annually. It supports SSO and SAML via Okta and Azure AD, is GDPR compliant with a DPA available on request, and encrypts data at rest and in transit. Data residency is available in US and EU regions, and the platform is pen-tested quarterly by a third party.`,
  },
  {
    id: "roi",
    title: "ROI",
    source: "demoless.com/roi",
    text: `Teams replace the demo queue and reclaim selling time. A typical team running outbound reclaims about 12.4 rep-hours per week and adds roughly $418K in pipeline per quarter. Every call is automatically scored for intent, with objections and a recommended follow-up landing in your pipeline the moment the call ends, so AEs only join calls that are actually ready.`,
  },
];

async function main() {
  console.log(`Seeding knowledge for "${SEED_COMPANY}"...`);
  const cleared = await clearKnowledge(SEED_COMPANY);
  if (cleared) console.log(`  cleared ${cleared} existing chunk(s)`);
  const n = await indexDocuments(SEED_COMPANY, SEED_DOCS);
  console.log(`  indexed ${n} chunk(s) from ${SEED_DOCS.length} doc(s)`);
  await closeRedis();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
