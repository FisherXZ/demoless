/**
 * Seed the Browserbase product knowledge base from scratch.
 *
 * Reads research/browserbase-kb/full-docs/documents.jsonl, selects the
 * demo-relevant subset (BROWSERBASE_ALLOWLIST), writes them to the Redis
 * source-of-record (demoless:kb-source:browserbase:*), then rebuilds the
 * vector index. This is a one-stop "fresh setup" that subsumes
 * `knowledge:curate` + `knowledge:reindex`.
 *
 *   docker run -p 6379:6379 redis/redis-stack:latest
 *   OPENAI_API_KEY=sk-...  npm run knowledge:seed
 *
 * For incremental updates (e.g. after editing a source doc):
 *   npm run knowledge:curate   # re-write source-of-record from documents.jsonl
 *   npm run knowledge:reindex  # rebuild vectors from source-of-record
 */
import * as fs from "fs";
import * as path from "path";
import { putSourceDoc, reindexFromSource, closeRedis } from "../lib/knowledge";
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

  const foundIds = new Set(selected.map((d) => d.id));
  const missing = BROWSERBASE_ALLOWLIST.filter((id) => !foundIds.has(id));
  if (missing.length) {
    console.warn(`  ⚠ ${missing.length} allowlisted id(s) not found: ${missing.join(", ")}`);
  }

  const now = new Date().toISOString();
  for (const raw of selected) {
    await putSourceDoc(COMPANY, toCuratedDoc(raw, now));
    process.stdout.write(`  ✓ ${raw.id}\n`);
  }

  await putSourceDoc(COMPANY, { ...APP_NAVIGATION_DOC, updatedAt: now });
  console.log(`  ✓ app-navigation (authored)`);

  console.log(`\nRebuilding vector index from source-of-record...`);
  const n = await reindexFromSource(COMPANY);
  console.log(`  indexed ${n} chunk(s) from ${selected.length + 1} source doc(s)`);

  await closeRedis();
  console.log("Done. Run `npm run knowledge:smoke` to verify retrieval.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
