import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const runtimeModules =
  "/Users/fisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeModules}/playwright/package.json`);
const { chromium } = require("playwright");

const seedUrls = [
  "https://www.karumi.ai/blog",
  "https://www.karumi.ai/blog/best-tips-improve-product-demo",
  "https://www.karumi.ai/blog/how-to-write-a-killer-demo-follow-up-email",
  "https://www.karumi.ai/blog/how-to-write-a-product-demo-script",
  "https://www.karumi.ai/blog/ai-sales-agents",
  "https://www.interactlabs.ai/product",
  "https://www.interactlabs.ai/stories/how-sprinto-turned-its-website-into-the-best-sales-rep",
  "https://www.hihobbes.com/features/conversational-intelligence",
  "https://www.hihobbes.com/features/self-improving-loops",
  "https://www.hihobbes.com/features/adaptive-experiences",
  "https://www.hihobbes.com/solutions/inbound",
  "https://www.hihobbes.com/solutions/outbound",
  "https://www.hihobbes.com/changle-log",
];

const outDir = "research";
const textDir = join(outDir, "page-text");

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(url) {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/^\/+|\/+$/g, "").replace(/\W+/g, "-");
  return `${parsed.hostname.replace(/\W+/g, "-")}-${path || "home"}`.slice(0, 140);
}

async function extractPage(page, url, source) {
  const startedAt = new Date().toISOString();
  let response = null;
  let error = null;

  try {
    response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_000);
  } catch (caught) {
    error = caught?.message || String(caught);
  }

  const finalUrl = page.url();
  const status = response?.status?.() ?? null;

  const data = await page.evaluate(() => {
    const textOf = (node) => (node?.innerText || node?.textContent || "").trim();
    const attr = (node, name) => node.getAttribute(name) || "";
    const meta = {};
    for (const node of document.querySelectorAll("meta")) {
      const key = attr(node, "name") || attr(node, "property");
      const content = attr(node, "content");
      if (key && content) meta[key] = content;
    }

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4"))
      .map((node) => ({
        level: node.tagName.toLowerCase(),
        text: textOf(node),
      }))
      .filter((item) => item.text);

    const ctas = Array.from(document.querySelectorAll("a,button"))
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        text: textOf(node),
        href: node.href || attr(node, "href"),
        ariaLabel: attr(node, "aria-label"),
      }))
      .filter((item) => item.text || item.ariaLabel || item.href)
      .slice(0, 240);

    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((node) => ({
        text: textOf(node),
        href: node.href,
      }))
      .filter((item) => item.href)
      .slice(0, 400);

    const images = Array.from(document.querySelectorAll("img"))
      .map((node) => ({
        alt: attr(node, "alt"),
        src: node.currentSrc || node.src || attr(node, "src"),
        width: node.naturalWidth || node.width || null,
        height: node.naturalHeight || node.height || null,
      }))
      .filter((item) => item.alt || item.src)
      .slice(0, 120);

    const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((node) => node.textContent || "")
      .filter(Boolean);

    return {
      title: document.title,
      h1: textOf(document.querySelector("h1")),
      meta,
      headings,
      ctas,
      links,
      images,
      jsonLd,
      bodyText: textOf(document.body),
    };
  });

  return {
    requestedUrl: url,
    finalUrl,
    source,
    status,
    fetchedAt: startedAt,
    error,
    ...data,
    bodyText: normalizeText(data.bodyText),
  };
}

function discoverKarumiArticleLinks(pageRecord) {
  if (!pageRecord?.finalUrl?.startsWith("https://www.karumi.ai/blog")) return [];
  return pageRecord.links
    .map((link) => link.href)
    .filter((href) => {
      try {
        const parsed = new URL(href);
        return (
          parsed.hostname === "www.karumi.ai" &&
          parsed.pathname.startsWith("/blog/") &&
          parsed.pathname !== "/blog/" &&
          parsed.pathname !== "/blog"
        );
      } catch {
        return false;
      }
    });
}

function unique(items) {
  return Array.from(new Set(items));
}

function markdownRecord(record) {
  const lines = [
    `# ${record.title || record.h1 || record.finalUrl}`,
    "",
    `- Requested: ${record.requestedUrl}`,
    `- Final: ${record.finalUrl}`,
    `- Status: ${record.status}`,
    `- Source: ${record.source}`,
    "",
    "## Headings",
    "",
    ...record.headings.map((heading) => `- ${heading.level}: ${heading.text}`),
    "",
    "## CTAs And Links",
    "",
    ...record.ctas
      .filter((cta) => cta.text || cta.ariaLabel)
      .slice(0, 80)
      .map((cta) => `- ${cta.text || cta.ariaLabel}${cta.href ? ` -> ${cta.href}` : ""}`),
    "",
    "## Text Stats",
    "",
    `- Extracted body characters: ${record.bodyTextLength}`,
    "",
  ];
  return lines.join("\n");
}

function publicRecord(record) {
  const { bodyText, ...rest } = record;
  return {
    ...rest,
    bodyTextLength: bodyText.length,
  };
}

await mkdir(textDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
});
const page = await context.newPage();

const queue = [...seedUrls];
const seen = new Set();
const records = [];

while (queue.length > 0) {
  const url = queue.shift();
  if (!url || seen.has(url)) continue;
  seen.add(url);

  console.log(`Fetching ${url}`);
  const record = await extractPage(page, url, seedUrls.includes(url) ? "seed" : "discovered");
  records.push(record);

  if (url === "https://www.karumi.ai/blog") {
    for (const discoveredUrl of unique(discoverKarumiArticleLinks(record))) {
      if (!seen.has(discoveredUrl)) queue.push(discoveredUrl);
    }
  }
}

await browser.close();

records.sort((a, b) => a.finalUrl.localeCompare(b.finalUrl));

const publicRecords = records.map(publicRecord);

await writeFile(join(outDir, "fetched-pages.json"), JSON.stringify(publicRecords, null, 2));
await writeFile(
  join(outDir, "fetched-pages.md"),
  publicRecords.map(markdownRecord).join("\n\n---\n\n"),
);

for (const record of publicRecords) {
  await writeFile(join(textDir, `${slugify(record.finalUrl)}.txt`), markdownRecord(record));
}

console.log(`Fetched ${records.length} pages into ${outDir}/`);
