/**
 * Curate the Browserbase product knowledge base for the demo agent.
 *
 * Reads research/browserbase-kb/full-docs/documents.jsonl, selects the
 * demo-relevant subset (BROWSERBASE_ALLOWLIST), writes them to the Redis
 * store-of-record (demoless:kb-source:browserbase:*), and writes the authored
 * app-navigation guide. The curation spec lives in lib/knowledge/curation.ts
 * so it can be unit-tested; this script is just the file IO + Redis writes.
 *
 * Run after changes to the allowlist or the authored navigation guide:
 *   OPENAI_API_KEY=sk-...  npm run knowledge:curate
 *
 * Then rebuild vectors:
 *   OPENAI_API_KEY=sk-...  npm run knowledge:reindex
 */
import * as fs from "fs";
import * as path from "path";
import { putSourceDoc, closeRedis } from "../lib/knowledge";
import {
  BROWSERBASE_ALLOWLIST,
  APP_NAVIGATION_DOC,
  toCuratedDoc,
  type RawDoc,
} from "../lib/knowledge/curation";

const COMPANY = "browserbase";

async function main() {
  const jsonlPath = path.resolve(
    process.cwd(),
    "research/browserbase-kb/full-docs/documents.jsonl"
  );

  if (!fs.existsSync(jsonlPath)) {
    console.error(`documents.jsonl not found at ${jsonlPath}`);
    process.exit(1);
  }

  const allow = new Set(BROWSERBASE_ALLOWLIST);
  const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
  const allDocs: RawDoc[] = lines.map((l) => JSON.parse(l) as RawDoc);

  const selected = allDocs.filter((d) => allow.has(d.id));
  console.log(
    `Curating ${selected.length} of ${allDocs.length} docs for "${COMPANY}"...`
  );

  // Warn if any allowlisted id is missing from the corpus (catches typos/renames).
  const foundIds = new Set(selected.map((d) => d.id));
  const missing = BROWSERBASE_ALLOWLIST.filter((id) => !foundIds.has(id));
  if (missing.length) {
    console.warn(`  ⚠ ${missing.length} allowlisted id(s) not found: ${missing.join(", ")}`);
  }

  let written = 0;
  const now = new Date().toISOString();
  for (const raw of selected) {
    await putSourceDoc(COMPANY, toCuratedDoc(raw, now));
    written++;
    process.stdout.write(`  ✓ ${raw.id}\n`);
  }

  // Write the authored app-navigation guide.
  await putSourceDoc(COMPANY, { ...APP_NAVIGATION_DOC, updatedAt: now });
  written++;
  console.log(`  ✓ app-navigation (authored)`);

  console.log(`\nWrote ${written} source docs to kb-source:${COMPANY}:*`);
  console.log(
    "Next: run `npm run knowledge:reindex` to rebuild the vector index."
  );

  await closeRedis();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
