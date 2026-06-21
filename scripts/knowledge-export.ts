/**
 * Export the Redis store-of-record to a reviewable JSON snapshot.
 *
 * Dumps all demoless:kb-source:{company}:* docs to stdout (or a file with
 * --out flag) so the curated content can be human-reviewed, version-controlled,
 * or restored after a Redis flush.
 *
 *   npm run knowledge:export
 *   npm run knowledge:export -- --out kb-snapshot.json
 *   npm run knowledge:export -- --company some-other-co
 */
import { listSourceDocs, closeRedis } from "../lib/knowledge";

const args = process.argv.slice(2);
const companyArg = args.indexOf("--company");
const outArg = args.indexOf("--out");

const COMPANY = companyArg !== -1 ? args[companyArg + 1] : "browserbase";
const OUT_FILE = outArg !== -1 ? args[outArg + 1] : null;

async function main() {
  console.error(`Exporting source docs for "${COMPANY}"...`);
  const docs = await listSourceDocs(COMPANY);
  docs.sort((a, b) => a.id.localeCompare(b.id));
  console.error(`  found ${docs.length} source doc(s)`);

  const json = JSON.stringify({ company: COMPANY, exportedAt: new Date().toISOString(), docs }, null, 2);

  if (OUT_FILE) {
    const fs = await import("fs");
    fs.writeFileSync(OUT_FILE, json, "utf8");
    console.error(`  written to ${OUT_FILE}`);
  } else {
    process.stdout.write(json + "\n");
  }

  await closeRedis();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
