# Perception Upgrade: Accessibility Tree + Vision Fallback

**Date:** 2026-06-21
**Branch:** `codex/perception-a11y-vision` (isolated worktree)
**Status:** Design approved, pending implementation plan

## Problem

The live voice agent drives a real browser (Browserbase cloud Chrome) for both the
Browserbase and Clay demos. Its only perception of a page today is a **plain DOM-text
scrape** (`lib/browser/session.ts#pageContext`):

- `links`: visible text of up to 20 `a, button, [role=link], [role=tab]` elements.
- `text`: `document.body.innerText`, sliced to 2800 chars.

This is a weak cousin of the browser's accessibility tree — it carries **no roles,
states, or structure**, and there is **no visual channel at all**. On a complex
logged-in app like Clay (grids, icon-only buttons, ambiguous repeated labels), the
agent often can't tell what's clickable or recover when a click silently mis-fires.

Industry practice (Playwright MCP "accessibility snapshots", computer-use agents)
leads with the **accessibility tree** for cheap structured perception and falls back
to **vision/screenshots** only when structure is ambiguous. This spec brings that
two-tier perception to our live agent.

## Scope

**In scope** — the live voice path only:

- `lib/browser/session.ts` — perception (`pageContext`) + new `screenshot`.
- `server/brain/tools.ts` — `ToolResult` shape + `look` schema.
- `server/brain/executor.ts` — vision wiring + failure-screenshot.
- `server/brain/turn.ts` — tolerate non-string tool-result content.

**Out of scope (explicitly deferred):**

- **Set-of-Marks (SoM)** numbered-overlay coordinate grounding — revisit only if Clay
  clicking proves unreliable after this lands.
- **Plan caching / AWM-offline** trajectory→playbook loop — a separate later spec.
- The dev-only **text-chat harness** (`server/loop.ts`, `server/model.ts#complete`) —
  untouched; it has a different `click_or_type` contract.

**Product-agnostic by design:** perception runs on whatever page is loaded, so both
Browserbase and Clay benefit with **zero per-product config**.

## Approved decisions

1. **Vision trigger = Option A:** screenshots are rare and fire two ways —
   (a) **auto-attached** to the error result when a `click`/`type` cannot find its
   target (the concrete "structure was ambiguous" signal), and
   (b) on an **explicit** `look(visual: true)` request from the model.
   Default every-turn perception stays text-only (a11y tree). Screenshots never ride
   on a normal `look`/`navigate`/`click` success.

2. **Replace, don't duplicate:** the a11y interactive-element list replaces the old
   `links` text-scrape. Visible `text` is kept for Q&A.

## Architecture & data flow

### 1. `lib/browser/session.ts`

**`pageContext()` — new return shape**

```ts
export interface PageContext {
  url: string;
  title: string;
  elements: string[]; // a11y interactive elements: `role "name" [state]`
  text: string;       // visible innerText, capped (unchanged)
}
```

`elements` is built from the browser accessibility tree, not a DOM scrape:

- Source: `page.accessibility.snapshot({ interestingOnly: true })` (walk the tree).
  Rationale for the tree-walk over `ariaSnapshot()` YAML: we want a **flat, capped,
  interactive-only** list that is token-cheap and directly maps to a click target —
  not a full-page YAML dump.
- Keep nodes whose `role` is interactive: `button, link, textbox, searchbox, combobox,
  checkbox, radio, tab, menuitem, option, switch, slider, link, listbox`. (Exact set
  finalized in the plan; headings/text/img are dropped.)
- Emit one line per node: `role "name"`, appending `[state]` when a meaningful state is
  present (`disabled`, `checked`, `expanded`, `selected`).
- Dedupe identical lines; cap at ~30 entries (tunable). Names trimmed/whitespace-collapsed.
- Robustness: wrapped in `.catch(() => [])` exactly like the current scrape, so a
  snapshot failure degrades to an empty list rather than throwing.

`text` extraction is unchanged (innerText, collapsed, sliced to 2800).

**`screenshot()` — new function**

```ts
export async function screenshot(
  sessionId: string
): Promise<{ base64: string; mediaType: "image/jpeg" }>;
```

- `page.screenshot({ type: "jpeg", quality: ~60 })`, **viewport-only** (no full-page) to
  bound size and latency on the live loop.
- Returns base64 + media type for an Anthropic image block. Throws via the existing
  "No live session" guard if the session is missing; callers handle failure (below).

### 2. `server/brain/tools.ts`

**Widen `ToolResult.content`** to carry images:

```ts
export interface ToolResult {
  ok: boolean;
  content: string | Anthropic.ContentBlockParam[]; // text, or text + image blocks
}
```

**`look` gains an optional `visual` flag:**

```ts
{ name: "look",
  description: "Read the current page (title, elements, text). Pass visual:true to ALSO
                attach a screenshot when text isn't enough (a chart, an icon-only control,
                an ambiguous layout). Use sparingly.",
  input_schema: { type: "object",
    properties: { visual: { type: "boolean" } }, required: [] } }
```

The other tool schemas are unchanged. `pageToText` is updated to render `elements`
(renamed from `links`) into the text block.

### 3. `server/brain/executor.ts`

- `pageToText(p)` renders `Elements:` (the a11y list) instead of `Links:`.
- **`look`**: when `input.visual` is true, take a `screenshot` and return
  `content: [{type:"text", text: pageToText(...)}, {type:"image", source:{type:"base64", media_type, data}}]`.
  On screenshot failure, fall back to text-only (never throw the turn).
- **`click` / `type` failure path**: today a thrown error returns
  `{ ok:false, content: "tool X failed: …" }`. Upgrade so that when the failure is an
  element-not-found / timeout, we **attach a screenshot** to the error result:
  `content: [{type:"text", text:"tool click failed: … — here is what's on screen"},
  {type:"image", …}]`, `ok:false`. This is the auto-fallback that lets the model
  visually self-correct. Screenshot failure → plain text error (unchanged behavior).
- A small helper builds the `[text, image]` block array so `look` and the failure path
  share one code path.

### 4. `server/brain/turn.ts`

- `messages.push({role:"user", content: results})` already passes `r.content` straight
  through — Anthropic accepts an array of blocks as `tool_result` content, so the image
  rides along unchanged.
- **One fix:** the `screen_is_on` label extraction (currently
  `r.content.match(/^Title: …/m)`) assumes a string. Guard it to only regex-match when
  `typeof r.content === "string"`; for array content, extract the text block first (or
  fall back to the input URL). No other change.

### Why `server/model.ts` needs no change

`streamWithTools` only forwards `req.messages`; the image blocks live inside the
`tool_result` entries that `turn.ts` builds. The model is already `claude-opus-4-8`
(multimodal). Prompt caching of system + tools is unaffected (images live in the
non-cached message tail).

## Error handling

- A11y snapshot failure → empty `elements` (matches today's `.catch(() => [])`); the
  agent still has `text`.
- Screenshot failure (no session, CDP blip) → vision path silently degrades to
  text-only; the turn never throws on account of perception.
- Oversized screenshots are bounded by jpeg quality + viewport-only capture; no
  full-page captures.

## Testing

All Browserbase/CDP calls are faked via the existing `server/fakes/` + executor-test
`BrowserLane` fake pattern. Target: full `npm test` green (baseline **436 passing**).

- **`session.ts`**: unit-test the a11y serializer against a snapshot-tree fixture →
  asserts interactive-only, capped, `role "name" [state]` formatting, dedupe, and the
  `.catch` empty-list fallback. Test `screenshot` returns `{base64, mediaType}` shape
  (fake page).
- **`executor.test.ts`**: `look({visual:true})` returns a `[text, image]` block array;
  a `click` that throws element-not-found returns `ok:false` with an image block;
  screenshot failure degrades to text-only. Extend the fake `BrowserLane` with
  `screenshot`.
- **`turn.test.ts`**: a tool result whose `content` is a `[text, image]` array
  round-trips into `messages` and the `screen_is_on` label extraction does not crash.
- **`tools.test.ts`**: `look` schema accepts optional `visual`.

## Success criteria

1. `pageContext().elements` carries role/name/state for interactive elements on a real
   page; `links` is gone.
2. The model can call `look(visual:true)` and receive a screenshot block.
3. A failed `click`/`type` returns an error result that includes a screenshot.
4. Both demos (Browserbase, Clay) exercise the new perception with no per-product code.
5. `npm test` green; no regression in the live turn loop.

## Risks / open items (resolve during plan)

- Final interactive-role allowlist and the `elements` cap (~30) — tune against a real
  Clay page during implementation.
- `page.accessibility.snapshot` is marked legacy in newer Playwright; confirm the
  installed `playwright-core` version supports it, else switch the serializer to
  `ariaSnapshot()` parsing (same output contract, different source). The `PageContext`
  interface does not change either way.
