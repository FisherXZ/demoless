# Browserbase Docs Embedding Handoff

Generated from the official Browserbase docs index at
`https://docs.browserbase.com/llms.txt`.

## Files

- `manifest.json` - counts, generation time, and failures.
- `documents.jsonl` - one JSON object per docs page. Use this if you want to
  chunk with your own embedder.
- `chunks.jsonl` - pre-chunked records ready for embeddings.
- `documents.md` - all docs concatenated for human inspection.

## Counts

- Documents expected: 174
- Documents fetched: 174
- Fetch failures: 0
- Prebuilt chunks: 1496

## JSONL Shapes

`documents.jsonl`:

```json
{
  "id": "platform__browser__core-features__contexts",
  "title": "Contexts",
  "group": "platform / browser / core-features",
  "url": "https://docs.browserbase.com/platform/browser/core-features/contexts.md",
  "path": "platform/browser/core-features/contexts.md",
  "description": "Reuse cookies, authentication, and application data across browser sessions.",
  "fetchedAt": "2026-06-21T00:49:46.552Z",
  "text": "...",
  "characters": 10571
}
```

`chunks.jsonl`:

```json
{
  "id": "platform__browser__core-features__contexts#chunk-001",
  "docId": "platform__browser__core-features__contexts",
  "url": "https://docs.browserbase.com/platform/browser/core-features/contexts.md",
  "title": "Contexts",
  "group": "platform / browser / core-features",
  "headingPath": ["Contexts", "Why use Contexts?"],
  "text": "...",
  "sourceLine": 42
}
```

## Recommended Embedding Input

Embed `chunks.jsonl`. For each line, use:

```text
Title: {title}
Group: {group}
Heading: {headingPath joined with " > "}
URL: {url}

{text}
```

Store the embedding with at least these metadata fields:

- `id`
- `docId`
- `url`
- `title`
- `group`
- `headingPath`
- `sourceLine`

The generated chunks target about 1,800 characters with small overlap for long
sections.
