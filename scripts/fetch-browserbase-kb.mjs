import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pages = [
  ["Docs index", "https://docs.browserbase.com/llms.txt"],
  ["Introduction", "https://docs.browserbase.com/welcome/introduction.md"],
  ["What is Browserbase", "https://docs.browserbase.com/welcome/what-is-browserbase.md"],
  ["Create a browser session", "https://docs.browserbase.com/platform/browser/getting-started/create-browser-session.md"],
  ["Using a browser session", "https://docs.browserbase.com/platform/browser/getting-started/using-browser-session.md"],
  ["Manage a browser session", "https://docs.browserbase.com/platform/browser/getting-started/manage-browser-session.md"],
  ["Core browser features", "https://docs.browserbase.com/platform/browser/core-features/overview.md"],
  ["Contexts", "https://docs.browserbase.com/platform/browser/core-features/contexts.md"],
  ["Long sessions", "https://docs.browserbase.com/platform/browser/long-sessions/overview.md"],
  ["Observability", "https://docs.browserbase.com/platform/browser/observability/observability.md"],
  ["Session live view", "https://docs.browserbase.com/platform/browser/observability/session-live-view.md"],
  ["Session recording", "https://docs.browserbase.com/platform/browser/observability/session-recording.md"],
  ["Session replay", "https://docs.browserbase.com/platform/browser/observability/session-replay.md"],
  ["Fetch", "https://docs.browserbase.com/platform/fetch/overview.md"],
  ["Search", "https://docs.browserbase.com/platform/search/overview.md"],
  ["Agent identity", "https://docs.browserbase.com/platform/identity/overview.md"],
  ["Website authentication", "https://docs.browserbase.com/platform/identity/authentication.md"],
  ["Allowed domains", "https://docs.browserbase.com/platform/identity/allowed-domains.md"],
  ["Proxies", "https://docs.browserbase.com/platform/identity/proxies.md"],
  ["Functions", "https://docs.browserbase.com/platform/runtime/overview.md"],
  ["Model Gateway", "https://docs.browserbase.com/platform/model-gateway/overview.md"],
  ["Enterprise security", "https://docs.browserbase.com/account/enterprise/security.md"],
  ["Zero data retention", "https://docs.browserbase.com/account/enterprise/zero-data-retention.md"],
  ["Concurrency management", "https://docs.browserbase.com/optimizations/concurrency/overview.md"],
  ["Browser regions", "https://docs.browserbase.com/optimizations/latency/multi-region.md"],
  ["Node SDK", "https://docs.browserbase.com/reference/sdk/nodejs.md"],
  ["Stagehand quickstart", "https://docs.browserbase.com/welcome/quickstarts/stagehand.md"],
  ["Playwright quickstart", "https://docs.browserbase.com/welcome/quickstarts/playwright.md"],
  ["Use case: browser agents", "https://docs.browserbase.com/use-cases/agents.md"],
  ["Use case: web data retrieval", "https://docs.browserbase.com/use-cases/web-data-retrieval.md"],
  ["Use case: automated testing", "https://docs.browserbase.com/use-cases/building-automated-tests.md"],
];

const outDir = join("research", "browserbase-kb");

function normalizeMarkdown(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function fetchPage(title, url) {
  const response = await fetch(url, {
    headers: { "user-agent": "demoless-kb-scraper/1.0" },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return {
    title,
    url,
    fetchedAt: new Date().toISOString(),
    text: normalizeMarkdown(await response.text()),
  };
}

await mkdir(outDir, { recursive: true });

const records = [];
for (const [title, url] of pages) {
  console.log(`Fetching ${title}: ${url}`);
  records.push(await fetchPage(title, url));
}

const rawMarkdown = records
  .map(
    (record) => [
      `# ${record.title}`,
      "",
      `Source: ${record.url}`,
      `Fetched: ${record.fetchedAt}`,
      "",
      record.text,
    ].join("\n"),
  )
  .join("\n\n---\n\n");

const sourceList = [
  "# Browserbase KB Sources",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  ...records.map((record) => `- [${record.title}](${record.url})`),
  "",
];

await writeFile(join(outDir, "raw-pages.md"), rawMarkdown);
await writeFile(join(outDir, "sources.md"), sourceList.join("\n"));
await writeFile(
  join(outDir, "records.json"),
  JSON.stringify(
    records.map(({ title, url, fetchedAt, text }) => ({
      title,
      url,
      fetchedAt,
      characters: text.length,
    })),
    null,
    2,
  ),
);

console.log(`Fetched ${records.length} Browserbase docs pages into ${outDir}/`);
