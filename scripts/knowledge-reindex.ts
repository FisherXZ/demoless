/**
 * Rebuild the Browserbase vector index from the Redis store-of-record.
 *
 * Reads all docs from demoless:kb-source:browserbase:*, clears the existing
 * demoless:kb:browserbase:* chunks, and re-embeds everything. Run this after
 * knowledge:curate or after editing source docs directly.
 *
 *   docker run -p 6379:6379 redis/redis-stack:latest
 *   OPENAI_API_KEY=sk-...  npm run knowledge:reindex
 */
import { reindexFromSource, closeRedis } from "../lib/knowledge";

const COMPANY = "browserbase";

async function main() {
  console.log(`Reindexing knowledge for "${COMPANY}" from source-of-record...`);
  const n = await reindexFromSource(COMPANY);
  console.log(`  indexed ${n} chunk(s)`);
  await closeRedis();
  console.log("Done. Run `npm run knowledge:smoke` to verify retrieval.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
