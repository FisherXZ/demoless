import { createRequire } from "node:module";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const runtimeModules =
  "/Users/fisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeModules}/playwright/package.json`);
const { chromium } = require("playwright");

const startUrl = "https://docs.clay.com";
const sitemapUrl = "https://university.clay.com/sitemap.xml";
const outDir = join("research", "clay-kb");
const rawDir = join(outDir, "raw-docs");
const htmlDir = join(rawDir, "html");
const markdownDir = join(rawDir, "markdown");
const maxPages = Number(process.env.CLAY_DOCS_MAX_PAGES || 1_000);
const workerCount = Number(process.env.CLAY_DOCS_FETCH_WORKERS || 5);

function cleanText(value) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeUrl(href) {
  const url = new URL(href, "https://university.clay.com");
  url.hash = "";
  if (url.hostname === "docs.clay.com") url.hostname = "university.clay.com";
  if (url.hostname === "university.clay.com") url.protocol = "https:";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function isClayDocsUrl(href) {
  let url;
  try {
    url = new URL(normalizeUrl(href));
  } catch {
    return false;
  }
  if (url.hostname !== "university.clay.com") return false;
  const decodedPath = decodeURIComponent(url.pathname);
  if (/[<>]/.test(decodedPath) || decodedPath.includes("http://") || decodedPath.includes("https://")) return false;
  return url.pathname === "/docs" || url.pathname.startsWith("/docs/") || url.pathname.startsWith("/docs-topics/");
}

function pathFromUrl(href) {
  const url = new URL(normalizeUrl(href));
  return url.pathname.replace(/^\//, "") || "docs";
}

function slugFromPath(path) {
  return path
    .replace(/^docs$/, "docs/index")
    .replace(/[^a-zA-Z0-9/._-]+/g, "-")
    .replace(/\//g, "__");
}

function sectionFromPath(path) {
  if (path === "docs") return "docs";
  if (path.startsWith("docs-topics/")) return "docs-topics";
  return "docs-page";
}

function titleFromPath(path) {
  const leaf = path.split("/").filter(Boolean).at(-1) || "docs";
  return leaf
    .split("-")
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

async function fetchSitemap() {
  const response = await fetch(sitemapUrl, {
    headers: { "user-agent": "demoless-clay-docs-browser-crawler/1.0" },
  });
  if (!response.ok) throw new Error(`Sitemap failed: ${response.status} ${response.statusText}`);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1])
    .filter(isClayDocsUrl)
    .map(normalizeUrl);
}

function markdownInventory(entries, generatedAt) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.section)) groups.set(entry.section, []);
    groups.get(entry.section).push(entry);
  }

  const lines = [
    "# Clay Docs Inventory",
    "",
    `Generated: ${generatedAt}`,
    `Source sitemap: ${sitemapUrl}`,
    `Docs URLs: ${entries.length}`,
    "",
    "This inventory contains Clay University documentation URLs only: `/docs` and `/docs-topics`.",
    "",
  ];

  for (const [section, sectionEntries] of groups.entries()) {
    lines.push(`## ${section} (${sectionEntries.length})`, "");
    for (const entry of sectionEntries) {
      lines.push(`- [${entry.title}](${entry.url})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function combinedMarkdown(docs) {
  return docs
    .map((doc) =>
      [
        `# ${doc.title || doc.h1 || doc.path}`,
        "",
        `Source: ${doc.url}`,
        `Path: ${doc.path}`,
        `Section: ${doc.section}`,
        doc.description ? `Description: ${doc.description}` : "",
        "",
        doc.markdown || doc.text,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}

async function extractPage(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(350);

  const data = await page.evaluate(() => {
    const clean = (value) =>
      String(value || "")
        .replace(/\u200b/g, "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

    const escapeMarkdown = (value) => clean(value).replace(/([\\`*_{}[\]()#+.!|-])/g, "\\$1");
    const absoluteUrl = (href) => {
      const rawHref = String(href || "").trim();
      const unwrappedHref = rawHref.replace(/^<(.+)>$/, "$1");
      try {
        const url = new URL(unwrappedHref, location.href);
        if (url.hostname === "docs.clay.com") url.hostname = "university.clay.com";
        if (url.hostname === "university.clay.com") url.protocol = "https:";
        return url.toString();
      } catch {
        return rawHref;
      }
    };

    const blockTags = new Set([
      "ADDRESS",
      "ARTICLE",
      "ASIDE",
      "BLOCKQUOTE",
      "DIV",
      "DL",
      "FIELDSET",
      "FIGCAPTION",
      "FIGURE",
      "FOOTER",
      "FORM",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "HEADER",
      "HR",
      "LI",
      "MAIN",
      "NAV",
      "OL",
      "P",
      "PRE",
      "SECTION",
      "TABLE",
      "UL",
    ]);

    function inlineMarkdown(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName;
      const text = () => Array.from(node.childNodes).map(inlineMarkdown).join("");

      if (tag === "BR") return "\n";
      if (tag === "CODE") return `\`${clean(node.textContent).replace(/`/g, "\\`")}\``;
      if (tag === "STRONG" || tag === "B") return `**${clean(text())}**`;
      if (tag === "EM" || tag === "I") return `_${clean(text())}_`;
      if (tag === "A") {
        const label = clean(text()) || clean(node.getAttribute("aria-label")) || node.href;
        const href = absoluteUrl(node.getAttribute("href") || node.href);
        return href ? `[${label.replace(/[\[\]]/g, "")}](${href})` : label;
      }
      if (tag === "IMG") {
        const alt = clean(node.getAttribute("alt"));
        const src = absoluteUrl(node.getAttribute("src") || node.src);
        return src ? `![${alt.replace(/[\[\]]/g, "")}](${src})` : "";
      }
      if (blockTags.has(tag)) return clean(text());
      return text();
    }

    function elementMarkdown(node, depth = 0) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName;
      const children = () =>
        Array.from(node.children)
          .map((child) => elementMarkdown(child, depth))
          .filter(Boolean)
          .join("\n\n");

      if (/^H[1-6]$/.test(tag)) {
        return `${"#".repeat(Number(tag.slice(1)))} ${clean(node.textContent)}`;
      }
      if (tag === "P") return clean(inlineMarkdown(node));
      if (tag === "PRE") return `\`\`\`\n${(node.textContent || "").trim()}\n\`\`\``;
      if (tag === "BLOCKQUOTE") {
        return clean(node.innerText)
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
      }
      if (tag === "UL" || tag === "OL") {
        return Array.from(node.children)
          .filter((child) => child.tagName === "LI")
          .map((item, index) => {
            const marker = tag === "OL" ? `${index + 1}.` : "-";
            const itemText = clean(inlineMarkdown(item));
            return `${"  ".repeat(depth)}${marker} ${itemText}`;
          })
          .join("\n");
      }
      if (tag === "TABLE") {
        const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
          Array.from(row.children).map((cell) => clean(cell.innerText).replace(/\|/g, "\\|")),
        );
        if (!rows.length) return "";
        const width = Math.max(...rows.map((row) => row.length));
        const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
        const [head, ...body] = normalized;
        return [
          `| ${head.join(" | ")} |`,
          `| ${Array(width).fill("---").join(" | ")} |`,
          ...body.map((row) => `| ${row.join(" | ")} |`),
        ].join("\n");
      }
      if (tag === "IMG") return inlineMarkdown(node);
      if (tag === "FIGURE") return clean([children(), inlineMarkdown(node)].filter(Boolean).join("\n\n"));
      return children() || clean(inlineMarkdown(node));
    }

    const articleRoot =
      document.querySelector(".rich-text.w-richtext") ||
      document.querySelector("article") ||
      document.querySelector("main.columned-body_main") ||
      document.querySelector("main#main") ||
      document.querySelector("main") ||
      document.body;

    const contentShell =
      document.querySelector("main.columned-body_main") ||
      document.querySelector("main#main") ||
      articleRoot;

    const h1 = clean(document.querySelector("h1")?.innerText);
    const description =
      clean(document.querySelector('meta[name="description"]')?.getAttribute("content")) ||
      clean(document.querySelector(".page-header_text, .hero_subtitle, .body-large")?.innerText);
    const articleMarkdown = clean(elementMarkdown(articleRoot));
    const titleMarkdown = [`# ${h1}`, description].filter(Boolean).join("\n\n");
    const markdown = clean([titleMarkdown, articleMarkdown].filter(Boolean).join("\n\n"));
    const text = clean([h1, description, articleRoot.innerText].filter(Boolean).join("\n\n"));

    return {
      finalUrl: location.href,
      pageTitle: document.title,
      h1,
      description,
      html: document.documentElement.outerHTML,
      contentHtml: contentShell.outerHTML,
      articleHtml: articleRoot.outerHTML,
      markdown,
      text,
      headings: Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4"))
        .map((heading) => ({ level: heading.tagName.toLowerCase(), text: clean(heading.innerText) }))
        .filter((heading) => heading.text),
      breadcrumbs: Array.from(document.querySelectorAll('main a[href*="/docs"], main a[href*="/docs-topics"]'))
        .slice(0, 8)
        .map((anchor) => clean(anchor.innerText || anchor.textContent))
        .filter(Boolean),
      localDocsLinks: Array.from(document.querySelectorAll('a[href]'))
        .map((anchor) => ({
          text: clean(anchor.innerText || anchor.textContent || anchor.getAttribute("aria-label")),
          href: absoluteUrl(anchor.getAttribute("href") || anchor.href),
        }))
        .filter((link) => link.href && link.text),
      images: Array.from(document.querySelectorAll("main img[src]"))
        .map((img) => ({
          alt: clean(img.getAttribute("alt")),
          src: absoluteUrl(img.getAttribute("src") || img.src),
          width: img.naturalWidth || img.width || null,
          height: img.naturalHeight || img.height || null,
        }))
        .filter((image) => image.src),
    };
  });

  return {
    status: response?.status?.() ?? null,
    ...data,
  };
}

async function crawlOne(context, entry, index, total) {
  const page = await context.newPage();
  try {
    process.stdout.write(`[${index + 1}/${total}] ${entry.url}\n`);
    const data = await extractPage(page, entry.url);
    const path = pathFromUrl(data.finalUrl || entry.url);
    if (data.status >= 400) {
      return {
        ok: false,
        url: entry.url,
        finalUrl: normalizeUrl(data.finalUrl || entry.url),
        path,
        section: sectionFromPath(path),
        title: data.h1 || data.pageTitle || entry.title,
        status: data.status,
        error: `HTTP ${data.status}`,
        fetchedAt: new Date().toISOString(),
      };
    }
    const id = slugFromPath(path);
    const discoveredDocsLinks = [
      ...new Set(
        data.localDocsLinks
          .map((link) => link.href)
          .filter(isClayDocsUrl)
          .map(normalizeUrl),
      ),
    ];

    return {
      ok: true,
      id,
      url: entry.url,
      finalUrl: normalizeUrl(data.finalUrl || entry.url),
      path,
      section: sectionFromPath(path),
      title: data.h1 || data.pageTitle || entry.title,
      pageTitle: data.pageTitle,
      h1: data.h1,
      description: data.description,
      status: data.status,
      fetchedAt: new Date().toISOString(),
      markdown: cleanText(data.markdown),
      text: cleanText(data.text),
      headings: data.headings,
      breadcrumbs: data.breadcrumbs,
      localDocsLinks: discoveredDocsLinks,
      images: data.images,
      html: data.html,
      contentHtml: data.contentHtml,
      articleHtml: data.articleHtml,
      characters: cleanText(data.text).length,
    };
  } catch (error) {
    return {
      ok: false,
      url: entry.url,
      path: pathFromUrl(entry.url),
      section: sectionFromPath(pathFromUrl(entry.url)),
      title: entry.title,
      error: error?.message || String(error),
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

await rm(rawDir, { recursive: true, force: true });
await mkdir(htmlDir, { recursive: true });
await mkdir(markdownDir, { recursive: true });

const sitemapUrls = await fetchSitemap();
const generatedAt = new Date().toISOString();
const inventory = sitemapUrls
  .map((url) => {
    const path = pathFromUrl(url);
    return {
      id: slugFromPath(path),
      title: titleFromPath(path),
      url,
      path,
      section: sectionFromPath(path),
      source: "sitemap",
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

await writeFile(join(outDir, "docs-inventory.json"), JSON.stringify({ generatedAt, sitemapUrl, entries: inventory }, null, 2));
await writeFile(join(outDir, "docs-inventory.md"), markdownInventory(inventory, generatedAt));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
});

const queued = new Map(inventory.map((entry) => [entry.url, entry]));
const crawled = new Set();
const docs = [];
const failures = [];

while (queued.size > crawled.size && crawled.size < maxPages) {
  const batch = [...queued.values()].filter((entry) => !crawled.has(entry.url)).slice(0, workerCount);
  const total = queued.size;
  const records = await Promise.all(batch.map((entry, batchIndex) => crawlOne(context, entry, crawled.size + batchIndex, total)));

  for (const entry of batch) crawled.add(entry.url);

  for (const record of records) {
    if (!record.ok) {
      failures.push(record);
      continue;
    }

    const { html, contentHtml, articleHtml, ...doc } = record;
    docs.push(doc);

    await writeFile(join(htmlDir, `${record.id}.html`), html);
    await writeFile(join(htmlDir, `${record.id}.content.html`), contentHtml);
    await writeFile(join(htmlDir, `${record.id}.article.html`), articleHtml);
    await writeFile(
      join(markdownDir, `${record.id}.md`),
      [
        `# ${record.title}`,
        "",
        `Source: ${record.finalUrl}`,
        `Path: ${record.path}`,
        `Section: ${record.section}`,
        record.description ? `Description: ${record.description}` : "",
        "",
        record.markdown,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    for (const link of record.localDocsLinks) {
      if (queued.has(link) || crawled.has(link) || queued.size >= maxPages) continue;
      const path = pathFromUrl(link);
      queued.set(link, {
        id: slugFromPath(path),
        title: titleFromPath(path),
        url: link,
        path,
        section: sectionFromPath(path),
        source: "rendered-link",
      });
    }
  }
}

await browser.close();

docs.sort((a, b) => a.path.localeCompare(b.path));
failures.sort((a, b) => a.path.localeCompare(b.path));

const allEntries = [...queued.values()].sort((a, b) => a.path.localeCompare(b.path));
const finishedAt = new Date().toISOString();
const manifest = {
  generatedAt: finishedAt,
  startUrl,
  sitemapUrl,
  source: "browser-rendered Clay University docs crawl",
  docsExpectedFromSitemap: inventory.length,
  docsDiscoveredTotal: allEntries.length,
  docsFetched: docs.length,
  failures: failures.length,
  note: "Raw docs only: no vectorization, no embedding, and no chunk index were generated.",
  files: {
    inventoryJson: "../docs-inventory.json",
    inventoryMarkdown: "../docs-inventory.md",
    documentsJsonl: "documents.jsonl",
    documentsMarkdown: "documents.md",
    manifest: "manifest.json",
    markdownDirectory: "markdown/",
    htmlDirectory: "html/",
  },
};

await writeFile(join(outDir, "docs-inventory.json"), JSON.stringify({ generatedAt: finishedAt, sitemapUrl, entries: allEntries }, null, 2));
await writeFile(join(outDir, "docs-inventory.md"), markdownInventory(allEntries, finishedAt));
await writeFile(join(rawDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await writeFile(join(rawDir, "documents.jsonl"), docs.map((doc) => JSON.stringify(doc)).join("\n") + "\n");
await writeFile(join(rawDir, "documents.md"), combinedMarkdown(docs));
await writeFile(join(rawDir, "sources.md"), docs.map((doc) => `- [${doc.title}](${doc.finalUrl})`).join("\n") + "\n");

if (failures.length > 0) {
  await writeFile(join(rawDir, "failures.json"), JSON.stringify(failures, null, 2));
}

console.log(
  JSON.stringify(
    {
      docsExpectedFromSitemap: inventory.length,
      docsDiscoveredTotal: allEntries.length,
      docsFetched: docs.length,
      failures: failures.length,
      outDir: rawDir,
    },
    null,
    2,
  ),
);
