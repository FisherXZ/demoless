import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const runtimeModules =
  "/Users/fisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeModules}/playwright/package.json`);
const { chromium } = require("playwright");

const inventoryPath = join("research", "browserbase-kb", "docs-inventory.json");
const outDir = join("research", "browserbase-kb");

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function webUrl(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== "docs.browserbase.com") return url;
  if (parsed.pathname.endsWith(".md")) parsed.pathname = parsed.pathname.slice(0, -3);
  return parsed.toString();
}

function normalizeUrl(href) {
  const url = new URL(href);
  url.hash = "";
  if (url.pathname.endsWith(".md")) url.pathname = url.pathname.slice(0, -3);
  return url.toString();
}

function markdownSummary(records, generatedAt) {
  const byGroup = new Map();
  for (const record of records) {
    if (!byGroup.has(record.group)) byGroup.set(record.group, []);
    byGroup.get(record.group).push(record);
  }

  const lines = [
    "# Browserbase Rendered Page Structure Crawl",
    "",
    `Generated: ${generatedAt}`,
    `Pages crawled: ${records.length}`,
    `OK: ${records.filter((r) => r.ok).length}`,
    `Errors: ${records.filter((r) => !r.ok).length}`,
    "",
    "This was produced by browser automation. It records page structure only: URL, title, H1, headings, breadcrumbs, and local docs links.",
    "",
  ];

  for (const [group, groupRecords] of byGroup.entries()) {
    lines.push(`## ${group} (${groupRecords.length})`, "");
    for (const record of groupRecords) {
      const status = record.ok ? "ok" : `error: ${record.error}`;
      lines.push(`### ${record.indexTitle}`);
      lines.push(`- URL: ${record.pageUrl}`);
      lines.push(`- Status: ${status}`);
      if (record.finalUrl) lines.push(`- Final URL: ${record.finalUrl}`);
      if (record.pageTitle) lines.push(`- Title: ${record.pageTitle}`);
      if (record.h1) lines.push(`- H1: ${record.h1}`);
      if (record.breadcrumbs.length) lines.push(`- Breadcrumbs: ${record.breadcrumbs.join(" / ")}`);
      if (record.headings.length) {
        lines.push("- Headings:");
        for (const heading of record.headings.slice(0, 20)) {
          lines.push(`  - ${heading.level}: ${heading.text}`);
        }
      }
      lines.push(`- Local docs links seen: ${record.localDocsLinks.length}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const pages = inventory.entries
  .filter((entry) => entry.type === "docs-page")
  .map((entry) => ({
    indexTitle: entry.title,
    indexUrl: entry.url,
    pageUrl: webUrl(entry.url),
    group: entry.group,
    description: entry.description,
  }));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
});

async function crawlOne(item, index) {
  const record = {
    ...item,
    ok: false,
    error: "",
    status: null,
    finalUrl: "",
    pageTitle: "",
    h1: "",
    breadcrumbs: [],
    headings: [],
    localDocsLinks: [],
  };

  const page = await context.newPage();
  try {
    process.stdout.write(`[${index + 1}/${pages.length}] ${item.pageUrl}\n`);
    const response = await page.goto(item.pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 18_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 1_500 }).catch(() => {});
    await page.waitForTimeout(150);

    const data = await page.evaluate(() => {
      const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4"))
        .map((heading) => ({
          level: heading.tagName.toLowerCase(),
          text: clean(heading.innerText || heading.textContent),
        }))
        .filter((heading) => heading.text);

      const breadcrumbs = Array.from(
        document.querySelectorAll('nav[aria-label*="readcrumb" i] a, [aria-label*="readcrumb" i] a'),
      )
        .map((node) => clean(node.innerText || node.textContent))
        .filter(Boolean);

      const localDocsLinks = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor) => ({
          text: clean(anchor.innerText || anchor.textContent || anchor.getAttribute("aria-label")),
          href: anchor.href,
        }))
        .filter((link) => link.text && link.href.startsWith("https://docs.browserbase.com/"));

      return {
        finalUrl: location.href,
        pageTitle: document.title,
        h1: clean(document.querySelector("main h1")?.innerText || document.querySelector("h1")?.innerText),
        breadcrumbs,
        headings,
        localDocsLinks,
      };
    });

    record.ok = true;
    record.status = response?.status?.() ?? null;
    record.finalUrl = data.finalUrl;
    record.pageTitle = data.pageTitle;
    record.h1 = data.h1;
    record.breadcrumbs = data.breadcrumbs;
    record.headings = data.headings;
    record.localDocsLinks = [
      ...new Map(
        data.localDocsLinks.map((link) => [
          normalizeUrl(link.href),
          { text: cleanText(link.text), href: normalizeUrl(link.href) },
        ]),
      ).values(),
    ];
  } catch (caught) {
    record.error = caught?.message || String(caught);
  } finally {
    await page.close().catch(() => {});
  }

  return record;
}

const records = new Array(pages.length);
let nextIndex = 0;
const workerCount = Number(process.env.BROWSERBASE_DOCS_CRAWL_WORKERS || 6);
const workers = Array.from({ length: workerCount }, async () => {
  while (nextIndex < pages.length) {
    const index = nextIndex;
    nextIndex += 1;
    records[index] = await crawlOne(pages[index], index);
  }
});

await Promise.all(workers);
await browser.close();

const generatedAt = new Date().toISOString();
await writeFile(
  join(outDir, "rendered-page-structure.json"),
  JSON.stringify({ generatedAt, sourceInventory: inventoryPath, records }, null, 2),
);
await writeFile(join(outDir, "rendered-page-structure.md"), markdownSummary(records, generatedAt));

const csvRows = [
  ["group", "indexTitle", "pageUrl", "ok", "status", "finalUrl", "pageTitle", "h1", "headingCount", "localDocsLinkCount"],
  ...records.map((record) => [
    record.group,
    record.indexTitle,
    record.pageUrl,
    String(record.ok),
    String(record.status ?? ""),
    record.finalUrl,
    record.pageTitle,
    record.h1,
    String(record.headings.length),
    String(record.localDocsLinks.length),
  ]),
];
const csv = csvRows
  .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  .join("\n");
await writeFile(join(outDir, "rendered-page-structure.csv"), csv);

console.log(
  JSON.stringify(
    {
      crawled: records.length,
      ok: records.filter((record) => record.ok).length,
      errors: records.filter((record) => !record.ok).length,
    },
    null,
    2,
  ),
);
