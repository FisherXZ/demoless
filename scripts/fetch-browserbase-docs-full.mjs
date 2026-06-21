import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const inventoryPath = join("research", "browserbase-kb", "docs-inventory.json");
const outDir = join("research", "browserbase-kb", "full-docs");

function normalizeMarkdown(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function slugFromPath(path) {
  return path
    .replace(/\.md$/, "")
    .replace(/^\.cursor\//, "internal/")
    .replace(/[^a-zA-Z0-9/._-]+/g, "-")
    .replace(/\//g, "__");
}

function headingPathFor(lines, index) {
  const stack = [];
  for (let i = 0; i <= index; i += 1) {
    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(lines[i] || "");
    if (!match) continue;
    const level = match[1].length;
    stack[level - 1] = match[2].replace(/\s+/g, " ").trim();
    stack.length = level;
  }
  return stack.filter(Boolean);
}

function chunkDocument(doc, maxChars = 1800, overlapChars = 180) {
  const lines = doc.text.split("\n");
  const sections = [];
  let current = { startLine: 0, headingPath: [], lines: [] };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,3}\s+/.test(line) && current.lines.length > 0) {
      sections.push(current);
      current = {
        startLine: i + 1,
        headingPath: headingPathFor(lines, i),
        lines: [line],
      };
    } else {
      if (current.lines.length === 0) current.headingPath = headingPathFor(lines, i);
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0) sections.push(current);

  const chunks = [];
  for (const section of sections) {
    const sectionText = section.lines.join("\n").trim();
    if (!sectionText) continue;

    if (sectionText.length <= maxChars) {
      chunks.push({
        id: `${doc.id}#chunk-${String(chunks.length + 1).padStart(3, "0")}`,
        docId: doc.id,
        url: doc.url,
        title: doc.title,
        group: doc.group,
        headingPath: section.headingPath,
        text: sectionText,
        sourceLine: section.startLine,
      });
      continue;
    }

    let cursor = 0;
    while (cursor < sectionText.length) {
      let end = Math.min(cursor + maxChars, sectionText.length);
      if (end < sectionText.length) {
        const boundary = Math.max(
          sectionText.lastIndexOf("\n\n", end),
          sectionText.lastIndexOf("\n", end),
          sectionText.lastIndexOf(". ", end),
        );
        if (boundary > cursor + maxChars * 0.55) end = boundary + 1;
      }

      const text = sectionText.slice(cursor, end).trim();
      if (text) {
        chunks.push({
          id: `${doc.id}#chunk-${String(chunks.length + 1).padStart(3, "0")}`,
          docId: doc.id,
          url: doc.url,
          title: doc.title,
          group: doc.group,
          headingPath: section.headingPath,
          text,
          sourceLine: section.startLine,
        });
      }

      if (end >= sectionText.length) break;
      cursor = Math.max(0, end - overlapChars);
    }
  }

  return chunks;
}

async function fetchDoc(entry) {
  const response = await fetch(entry.url, {
    headers: { "user-agent": "demoless-browserbase-full-docs/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const text = normalizeMarkdown(await response.text());
  return {
    id: slugFromPath(entry.path),
    title: entry.title,
    group: entry.group,
    url: entry.url,
    path: entry.path,
    description: entry.description,
    fetchedAt: new Date().toISOString(),
    text,
    characters: text.length,
  };
}

async function worker(queue, docs, failures) {
  while (queue.length > 0) {
    const entry = queue.shift();
    const index = docs.length + failures.length + 1;
    process.stdout.write(`[${index}] ${entry.url}\n`);
    try {
      docs.push(await fetchDoc(entry));
    } catch (error) {
      failures.push({
        title: entry.title,
        url: entry.url,
        path: entry.path,
        group: entry.group,
        error: error?.message || String(error),
      });
    }
  }
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const entries = inventory.entries.filter((entry) => entry.type === "docs-page");
const queue = [...entries];
const docs = [];
const failures = [];
const workerCount = Number(process.env.BROWSERBASE_DOCS_FETCH_WORKERS || 8);

await mkdir(outDir, { recursive: true });
await Promise.all(Array.from({ length: workerCount }, () => worker(queue, docs, failures)));

docs.sort((a, b) => a.path.localeCompare(b.path));

const chunks = docs.flatMap((doc) => chunkDocument(doc));
const generatedAt = new Date().toISOString();
const manifest = {
  generatedAt,
  sourceInventory: inventoryPath,
  docsExpected: entries.length,
  docsFetched: docs.length,
  failures,
  chunks: chunks.length,
  files: {
    documentsJsonl: "documents.jsonl",
    chunksJsonl: "chunks.jsonl",
    documentsMarkdown: "documents.md",
    manifest: "manifest.json",
  },
};

await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await writeFile(join(outDir, "documents.jsonl"), docs.map((doc) => JSON.stringify(doc)).join("\n") + "\n");
await writeFile(join(outDir, "chunks.jsonl"), chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n");
await writeFile(
  join(outDir, "documents.md"),
  docs
    .map((doc) =>
      [
        `# ${doc.title}`,
        "",
        `Source: ${doc.url}`,
        `Group: ${doc.group}`,
        `Path: ${doc.path}`,
        doc.description ? `Description: ${doc.description}` : "",
        "",
        doc.text,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n"),
);

if (failures.length > 0) {
  await writeFile(join(outDir, "failures.json"), JSON.stringify(failures, null, 2));
}

console.log(JSON.stringify({ docsFetched: docs.length, failures: failures.length, chunks: chunks.length }, null, 2));
