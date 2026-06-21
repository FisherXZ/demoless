import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const runtimeModules =
  "/Users/fisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeModules}/playwright/package.json`);
const { chromium } = require("playwright");

const startUrl = "https://docs.browserbase.com/welcome/introduction#the-browserbase-platform";
const outDir = join("research", "browserbase-kb");

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(href) {
  const url = new URL(href);
  url.hash = "";
  return url.toString();
}

function docsPath(url) {
  const parsed = new URL(url);
  return parsed.pathname.replace(/^\//, "");
}

function groupFromPath(path) {
  if (path === "integrations/get-started") return "integrations";
  if (path === "reference/introduction") return "reference";
  if (path.startsWith("welcome/quickstarts/")) return "welcome / quickstarts";
  if (path.startsWith("welcome/")) return "welcome";
  if (path.startsWith("platform/browser/getting-started/")) return "platform / browser / getting-started";
  if (path.startsWith("platform/browser/core-features/")) return "platform / browser / core-features";
  if (path.startsWith("platform/browser/files/")) return "platform / browser / files";
  if (path.startsWith("platform/browser/long-sessions/")) return "platform / browser / long-sessions";
  if (path.startsWith("platform/browser/observability/")) return "platform / browser / observability";
  if (path.startsWith("platform/browser/techniques/")) return "platform / browser / techniques";
  if (path.startsWith("platform/fetch/")) return "platform / fetch";
  if (path.startsWith("platform/search/")) return "platform / search";
  if (path.startsWith("platform/identity/")) return "platform / identity";
  if (path.startsWith("platform/model-gateway/")) return "platform / model-gateway";
  if (path.startsWith("platform/runtime/")) return "platform / runtime";
  if (path.startsWith("integrations/")) return `integrations / ${path.split("/")[1] || "overview"}`;
  if (path.startsWith("account/billing/")) return "account / billing";
  if (path.startsWith("account/enterprise/")) return "account / enterprise";
  if (path.startsWith("account/team/")) return "account / team";
  if (path.startsWith("optimizations/concurrency/")) return "optimizations / concurrency";
  if (path.startsWith("optimizations/cost/")) return "optimizations / cost";
  if (path.startsWith("optimizations/latency/")) return "optimizations / latency";
  if (path.startsWith("reference/api/")) return "reference / api";
  if (path.startsWith("reference/sdk/")) return "reference / sdk";
  if (path.startsWith("reference/")) return "reference";
  if (path.startsWith("use-cases/")) return "use-cases";
  return path.split("/")[0] || "root";
}

function markdownInventory({ finalUrl, title, extractedAt, navigation, pageSections, allDocsLinks }) {
  const grouped = new Map();
  for (const link of allDocsLinks) {
    if (!grouped.has(link.group)) grouped.set(link.group, []);
    grouped.get(link.group).push(link);
  }

  const lines = [
    "# Browserbase Rendered Docs Structure",
    "",
    `Generated: ${extractedAt}`,
    `Start URL: ${startUrl}`,
    `Final URL: ${finalUrl}`,
    `Page title: ${title}`,
    "",
    "This inventory was extracted with browser automation from the rendered docs page.",
    "",
    "## Page Sections",
    "",
    ...pageSections.map((section) => `- ${section.level}: ${section.text}`),
    "",
    "## Rendered Navigation Groups",
    "",
  ];

  for (const group of navigation) {
    lines.push(`### ${group.label || "(unlabeled)"} (${group.links.length})`, "");
    for (const link of group.links) {
      lines.push(`- [${link.text}](${link.href})`);
    }
    lines.push("");
  }

  lines.push("## All Browserbase Docs Links Seen In Rendered Page", "");
  for (const [group, links] of grouped.entries()) {
    lines.push(`### ${group} (${links.length})`, "");
    for (const link of links) {
      lines.push(`- [${link.text}](${link.href})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
});
const page = await context.newPage();

await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(1_000);

// Mintlify docs sidebars can be collapsed. Expand anything that announces an
// expandable state, then scroll the sidebars so virtual/lazy content has a
// chance to mount before extraction.
for (let pass = 0; pass < 5; pass++) {
  const clicked = await page.evaluate(async () => {
    const buttons = Array.from(
      document.querySelectorAll('aside button[aria-expanded="false"], nav button[aria-expanded="false"]'),
    ).filter((button) => {
      const text = (button.innerText || button.textContent || "").trim();
      return text && !/search|theme|login|sign in/i.test(text);
    });

    for (const button of buttons) {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    for (const scroller of document.querySelectorAll("aside, nav")) {
      scroller.scrollTop = scroller.scrollHeight;
    }

    return buttons.length;
  });
  await page.waitForTimeout(400);
  if (clicked === 0) break;
}

const screenshotPath = join(outDir, "rendered-docs-structure.png");
await page.screenshot({ path: screenshotPath, fullPage: true });

const extracted = await page.evaluate(() => {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const linkRecord = (anchor) => ({
    text: clean(anchor.innerText || anchor.textContent || anchor.getAttribute("aria-label")),
    href: anchor.href,
    ariaLabel: clean(anchor.getAttribute("aria-label")),
    role: clean(anchor.getAttribute("role")),
  });

  const pageSections = Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4"))
    .map((heading) => ({
      level: heading.tagName.toLowerCase(),
      text: clean(heading.innerText || heading.textContent),
    }))
    .filter((heading) => heading.text);

  const navContainers = Array.from(document.querySelectorAll("aside, nav")).filter((node) =>
    Array.from(node.querySelectorAll("a[href]")).some((anchor) => anchor.href.includes("docs.browserbase.com")),
  );

  const navigation = navContainers.map((container, index) => {
    const label =
      clean(container.getAttribute("aria-label")) ||
      clean(container.querySelector("h2,h3,[data-title]")?.innerText) ||
      `navigation-${index + 1}`;
    const links = Array.from(container.querySelectorAll("a[href]"))
      .map(linkRecord)
      .filter((link) => link.text && link.href.includes("docs.browserbase.com"));
    return { label, links };
  });

  const allLinks = Array.from(document.querySelectorAll("a[href]"))
    .map(linkRecord)
    .filter((link) => link.text && link.href.includes("docs.browserbase.com"));

  const cards = Array.from(document.querySelectorAll("main a[href]"))
    .map((anchor) => ({
      text: clean(anchor.innerText || anchor.textContent),
      href: anchor.href,
    }))
    .filter((link) => link.text && link.href);

  return {
    title: document.title,
    finalUrl: location.href,
    pageSections,
    navigation,
    allLinks,
    cards,
  };
});

const seen = new Map();
for (const link of extracted.allLinks) {
  const href = normalizeUrl(link.href);
  if (!href.startsWith("https://docs.browserbase.com/")) continue;
  if (!seen.has(href)) {
    const path = docsPath(href).replace(/\.md$/, "");
    seen.set(href, {
      text: cleanText(link.text || link.ariaLabel || path),
      href,
      path,
      group: groupFromPath(path),
    });
  }
}

const allDocsLinks = [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
const navigation = extracted.navigation.map((group) => {
  const unique = new Map();
  for (const link of group.links) {
    const href = normalizeUrl(link.href);
    if (!href.startsWith("https://docs.browserbase.com/")) continue;
    if (!unique.has(href)) unique.set(href, { text: cleanText(link.text), href });
  }
  return { label: group.label, links: [...unique.values()] };
});

const result = {
  startUrl,
  finalUrl: extracted.finalUrl,
  title: extracted.title,
  extractedAt: new Date().toISOString(),
  screenshotPath,
  pageSections: extracted.pageSections,
  navigation,
  cards: extracted.cards,
  allDocsLinks,
  counts: {
    navigationContainers: navigation.length,
    navigationLinks: navigation.reduce((sum, group) => sum + group.links.length, 0),
    uniqueDocsLinks: allDocsLinks.length,
    pageSections: extracted.pageSections.length,
    cards: extracted.cards.length,
  },
};

await writeFile(join(outDir, "rendered-docs-structure.json"), JSON.stringify(result, null, 2));
await writeFile(join(outDir, "rendered-docs-structure.md"), markdownInventory(result));

await browser.close();

console.log(JSON.stringify(result.counts, null, 2));
console.log(`Wrote ${join(outDir, "rendered-docs-structure.md")}`);
console.log(`Screenshot ${screenshotPath}`);
