import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const docsIndexUrl = "https://docs.browserbase.com/llms.txt";
const outDir = join("research", "browserbase-kb");

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function docsPath(url) {
  const parsed = new URL(url);
  return parsed.pathname.replace(/^\//, "");
}

function groupFromPath(path) {
  if (path === "integrations/get-started.md") return "integrations";
  if (path === "reference/introduction.md") return "reference";
  if (path === "package.json") return "metadata";
  if (path === "templates") return "external / optional";
  if (path === "changelog") return "external / optional";
  if (path === "overview") return "external / optional";
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
  if (path.startsWith(".cursor/")) return "internal / cursor";
  return path.split("/")[0] || "root";
}

function typeFromUrl(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== "docs.browserbase.com") return "external";
  if (parsed.pathname.endsWith(".yaml")) return "openapi";
  if (parsed.pathname.endsWith("package.json")) return "package";
  if (parsed.pathname.endsWith(".md")) return "docs-page";
  return "docs-link";
}

function parseIndex(markdown) {
  const entries = [];
  let section = "Unsectioned";
  let order = 0;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      section = line.replace(/^##\s+/, "").trim();
      continue;
    }

    const matches = [...line.matchAll(/\[([^\]]+)\]\(([^)]+)\)(?::\s*([^[]*?))?(?=\s+-\s*\[|$)/g)];
    for (const match of matches) {
      const title = normalizeWhitespace(match[1]);
      const url = match[2].trim();
      const description = normalizeWhitespace(match[3] || "");
      const path = docsPath(url);
      entries.push({
        order: order++,
        section,
        group: groupFromPath(path),
        title,
        url,
        path,
        type: typeFromUrl(url),
        description,
      });
    }
  }

  return entries;
}

function groupEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  }
  return [...groups.entries()].map(([group, groupEntries]) => ({
    group,
    count: groupEntries.length,
    entries: groupEntries,
  }));
}

function markdownInventory(entries, fetchedAt) {
  const grouped = groupEntries(entries.filter((entry) => entry.type !== "external"));
  const external = entries.filter((entry) => entry.type === "external");
  const lines = [
    "# Browserbase Docs Inventory",
    "",
    `Generated: ${fetchedAt}`,
    `Index source: ${docsIndexUrl}`,
    `Total indexed links: ${entries.length}`,
    `Browserbase docs links: ${entries.length - external.length}`,
    `External links: ${external.length}`,
    "",
    "This is a structure-only inventory from the official Browserbase docs index.",
    "It intentionally does not pull individual page bodies yet.",
    "",
  ];

  for (const group of grouped) {
    lines.push(`## ${group.group} (${group.count})`, "");
    for (const entry of group.entries) {
      const description = entry.description ? ` — ${entry.description}` : "";
      lines.push(`- [${entry.title}](${entry.url})${description}`);
    }
    lines.push("");
  }

  if (external.length > 0) {
    lines.push("## external / optional", "");
    for (const entry of external) {
      const description = entry.description ? ` — ${entry.description}` : "";
      lines.push(`- [${entry.title}](${entry.url})${description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const response = await fetch(docsIndexUrl, {
  headers: { "user-agent": "demoless-docs-inventory/1.0" },
});

if (!response.ok) {
  throw new Error(`${response.status} ${response.statusText} for ${docsIndexUrl}`);
}

const fetchedAt = new Date().toISOString();
const markdown = await response.text();
const entries = parseIndex(markdown);
const grouped = groupEntries(entries);

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "docs-index-raw.md"), markdown);
await writeFile(join(outDir, "docs-inventory.json"), JSON.stringify({ fetchedAt, docsIndexUrl, entries, grouped }, null, 2));
await writeFile(join(outDir, "docs-inventory.md"), markdownInventory(entries, fetchedAt));

console.log(`Indexed ${entries.length} links from ${docsIndexUrl}`);
console.log(`Wrote ${join(outDir, "docs-inventory.md")}`);
