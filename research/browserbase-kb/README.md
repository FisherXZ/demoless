# Browserbase Docs KB Handoff

This folder contains the Browserbase documentation corpus collected for the
Demoless product knowledge base work.

## What To Share

Send teammates to:

- `full-docs/chunks.jsonl` for embedding-ready chunks.
- `full-docs/documents.jsonl` if they want to re-chunk from full pages.
- `full-docs/README.md` for JSONL schemas and recommended embedding input.

## Coverage

- Source index: `https://docs.browserbase.com/llms.txt`
- Documents expected: 174
- Documents fetched: 174
- Fetch failures: 0
- Prebuilt chunks: 1496
- Rendered docs crawl: 174 pages OK, 0 errors, 0 non-200 responses

## Suggested Embedding Record

For each row in `full-docs/chunks.jsonl`, embed this text:

```text
Title: {title}
Group: {group}
Heading: {headingPath joined with " > "}
URL: {url}

{text}
```

Store at least these metadata fields with each vector:

- `id`
- `docId`
- `url`
- `title`
- `group`
- `headingPath`
- `sourceLine`

## Reproducibility

The scripts used for this pass are in `/scripts`:

- `structure-browserbase-docs.mjs`
- `structure-browserbase-docs-browser.mjs`
- `crawl-browserbase-docs-structure-browser.mjs`
- `fetch-browserbase-docs-full.mjs`
- `fetch-browserbase-kb.mjs`

The final embedding handoff is the `full-docs` directory.
