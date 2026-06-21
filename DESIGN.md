# Demoless — Design System

Source of truth for the visual system. Formalized from the existing prototype
(`app/globals.css`, `tailwind.config.ts`) and extended to cover the dashboard
surfaces. When code and this file disagree, this file wins — update the tokens
to match.

Date: 2026-06-20 · Set via /design-consultation.

---

## The one thing to remember

**"Serious, fast software that turns a conversation into intelligence."**

Every decision serves that. The product watches a buyer, learns, and hands a
sales team a scored, evidenced read on them. The design should feel *precise and
earned*, never decorative. If an element doesn't carry information or hierarchy,
it comes out.

## Tone: warm technical editorial

Reference north-star: **Stripe's warmth × Linear's precision.** Warm neutrals do
most of the work; color appears as *data and state*, not decoration; type is
confident and tightly tracked; numbers are monospaced so the dashboard reads like
an instrument, not a marketing page.

### What we are deliberately moving away from (de-slop mandate)

The earlier prototype read "a bit AI." These are banned going forward:

- ❌ **Default violet-indigo as a hero fill.** The accent is pulled bluer and used
  sparingly (see Color). No large indigo-washed panels as a default.
- ❌ **Decorative gradients, blobs, glow-rings.** No `radial-gradient` blobs behind
  mockups, no `dlRing` pulse halos, no `from-coal to-brand` gradient tiles. Flat,
  intentional surfaces only. (Functional gradients — e.g. a subtle scrim over a
  video for caption legibility — are fine.)
- ❌ **Template tropes.** No 3-column icon-square feature grids, no fake-logo cloud,
  no centered-everything hero, no "3×" testimonial brag card as decoration.
- ❌ **Soft-everything.** Tighten radii and shadows (see Radii/Elevation). Crisp
  beats pillowy.

What we keep (the good bones): warm stone-tinted neutrals, warm near-black ink on
warm paper, the dark "night" surfaces, Hanken + JetBrains Mono.

### Register split: light marketing, dark instrument app (2026-06-20)

The restraint mandate above was executed into *blandness* on the dashboard (flat
white, starved color, placeholder charts). Correction: the **app surfaces
(dashboard + demo room) are a dark "command center"**, the **marketing landing
stays light**. Dark earns the techy/trustworthy/wow read through *depth, mono data
texture, real chart craft, and disciplined-but-vivid color* — not through the
banned gradients/blobs/glow. See the **Dark instrument layer** under Color and the
dashboard component specs below. Light-surface specs in this file now apply to the
marketing register only.

---

## Typography

| Role | Font | Treatment |
|------|------|-----------|
| Display / headings | **Hanken Grotesk** (`--font-hanken`) | `font-extrabold`, tight tracking (`-0.02em` display, up to `-0.035em` on hero) |
| Body / UI | **Hanken Grotesk** | regular/medium/semibold, normal tracking |
| Micro-labels | **JetBrains Mono** (`--font-jetbrains`) | uppercase, `tracking-[0.06em–0.1em]`, `text-[11px]`, color `faint` |
| **Numbers / data** | **JetBrains Mono** | KPIs, scores, prices, counts, timestamps, axis labels — tabular feel. *New rule: all dashboard numerals are mono.* |

Scale (use Tailwind arbitrary values for one-offs, these are the anchors):
hero `text-[54px]/[1.04]` · page title `text-[22px]` · section head `text-[18–19px]`
· body `text-[15px]/[1.5]` · secondary `text-[13px]` · micro `text-[11px]`.

Rule: a screen has **one** extrabold focal heading. Everything else steps down.
Don't bold-stack.

---

## Color

Warm neutral foundation + indigo accent **used sparingly** + a disciplined status
set. Token names match `tailwind.config.ts`; values below are the refined target —
update the config to these.

### Foundation (carries ~90% of every screen)
| Token | Value | Use |
|-------|-------|-----|
| `ink` | `#1c1c1a` | primary text, near-black warm |
| `ink2` | `#44403c` | labels, secondary headings |
| `paper` | `#fafaf9` | app background |
| `muted` / `muted2` | `#57534e` / `#78716c` | secondary text |
| `faint` / `faint2` | `#a8a29e` / `#8a8782` | tertiary text, mono labels |
| `line` / `line2` / `line3` / `hair` | `#e7e5e4`→`#f0efed` | hairline borders (warm) |
| `wash`–`wash4` / `chip` | `#faf9f8`→`#f3f2f0` | subtle fills, table headers |
| `night`–`night3`, `coal`, `coalline` | `#161615`→`#34332f` | dark surfaces (room, sidebar, hero) |

### Accent — refined indigo, rationed
| Token | Old | **New (pulled bluer)** | Use |
|-------|-----|------|-----|
| `brand` | `#4f46e5` | **`#3138cc`** | primary action, single active/selected state, AI/live presence, ONE chart series |
| `branddeep` | `#4338ca` | **`#262aa6`** | numbers/links on light, hover |
| `brandsoft` | `#eef0ff` | **`#eaecfb`** | selected-row tint, small chips only |
| `brandsoft2` | `#f6f5ff` | **`#f4f5fc`** | rare, lightest hint |
| `brandborder` | `#dcdcfa` | **`#d2d4f2`** | active border |
| `indigotext` | `#312e81` | **`#232a78`** | deep indigo body on tint |

**Where indigo is allowed:** primary buttons, the one active/selected nav or row,
the "speaking/AI" presence cue, links, and exactly one data series in a chart.
**Where it is banned:** as a default card fill, as a page background, as a glow,
as a gradient. If you're reaching for an indigo wash to "add interest," stop —
use space and a hairline instead.

### Status / semantic (reserved meanings — never reuse for brand/decoration)
| Token | Value | Meaning |
|-------|-------|---------|
| `good` / `goodsoft` | `#15803d` / `#e7f6ec` | qualified, positive signal, interest |
| `warn` / `warnsoft` | `#b45309` / `#fcf3e6` | objection, caution, needs-attention |
| `danger` | `#dc2626` | destructive, REC dot, "needs a human" |
| `live` | `#22c55e` | active/streaming/speaking-now |

### Dark instrument layer — the app command center (tailwind tokens)
Layered warm-black surfaces carry the dashboard + room. Accents are *brightened to
glow on near-black* (the light `brand #3138cc` is invisible there).
| Token | Value | Use |
|-------|-------|-----|
| `obsidian` | `#0c0c0b` | app base (deepest) |
| `slate` / `slate2` / `slate3` | `#161614`→`#242420` | raised panel · nested/row-hover · input fill |
| `edge` / `edge2` | `#2b2a27` / `#201f1d` | dark hairline border · subtler divider |
| `chalk` / `ash` / `ember` | `#f3f1ec` / `#aba79e` / `#75716a` | text ramp on dark (primary/secondary/tertiary) |
| `brandlit` / `brandlit2` | `#7c82ff` / `#9aa0ff` | indigo accent on dark — action, active, AI; hover |
| `goodlit` / `warnlit` / `dangerlit` / `livelit` | `#34d399` / `#fbbf24` / `#f87171` / `#34d399` | status on dark |

Helpers (globals.css): `.dl-grid` faint engineering-grid texture · `.dl-num`
tabular numerals · `.dl-live-dot` breathing live glow · `.dl-scroll-dark`. A
`prefers-reduced-motion` guard now neutralizes all looping/entrance motion.

### Data viz
Charts use: **mono numerals**, warm-gray gridlines (`hair` light / `edge` dark),
and a restrained
series order — `brand` (primary series) → `good` (qualified/positive) → neutral
`stone300`. Donuts: filled arc in the series color on a `line2` track. Bars:
`barlo`/`barmid`/`barhi` (indigo tints) only for a single-hue bar chart; otherwise
semantic colors. Never rainbow a chart.

---

## Layout, spacing, radii, elevation, motion

**Grid & density.** Dashboard = left dark sidebar (~224px) + **dark `obsidian`
content** (instrument register). Content runs wide; full-bleed tables on sessions.
The demo room is full-screen dark. Marketing pages are light, max-width ~1200px. Dense-but-breathing: tables and KPI rows are
compact; marketing sections are generous.

**Spacing.** 4px base. Card padding `14–18px` (dashboard) / `22–26px` (marketing).
Section gaps `16–24px`. Don't pad dashboard cards like landing cards.

**Radii (tightened).** `rounded-[9px]` controls/chips · `rounded-xl (12px)` cards ·
`rounded-[14px]` large panels. No radius above 18px. Sharp enough to read precise.

**Elevation (restrained).** Default: hairline border, no shadow. Raised card:
`shadow-[0_1px_2px_rgba(0,0,0,.03)]`. Only true overlays (drawer, modal, video
controls) get a real shadow. Kill the soft ambient `0_8px_30px` glow on flat cards.

**Motion.** Keep `dlFade` (drawer/page enter, 0.3–0.45s), `dlBlink` (REC),
`dlSpeak` (active speaking pulse), `dlStep` (progress). **Remove `dlRing`** (glow
halo — decoration). Motion confirms state or draws the eye to the live thing;
it never loops for ambiance.

---

## Component patterns

### Existing (formalize, then de-slop)
- **Landing** — strip the radial-gradient blob, the glow-ring mockup, the fake-logo
  cloud, and the gradient avatar. Keep the warm type-forward hero; make the product
  mockup a flat, real-looking frame. The **scenario picker** (Browserbase / Demoless)
  is two clean cards, not a single CTA.
- **Demo room** — full-screen `night`. Center = real Browserbase live-view. Right
  rail = **live memory panel** (signal cards stream in). Thin `brand` progress bar
  over the product (replaces the section rail). Maya tile flat (no gradient), with a
  `live`-green speaking pulse. Captions over a functional scrim.

### New — dashboard patterns (build these to spec)
- **KPI row (dark).** Not four identical boxes — one **featured** metric (Qualified
  rate) on a `brandlit`-tinted gradient panel with a meter + ▲ delta, then secondary
  metrics on `slate`/`edge` cards: mono numeral (`text-[30px]` chalk), `ember`
  micro-label, a `goodlit`/`dangerlit` delta, and a sparkline where real series
  exist. Hierarchy via the featured card, not via decoration.
- **Timeline chart.** Two series max (All sessions = neutral, Qualified = `good` or
  `brand`), warm gridlines, mono axis labels, range toggle as plain chips.
- **Donut (device / source).** Single-arc, center mono total, legend rows with
  count + %. Track `line2`.
- **Sessions list.** Table or list rows: identity (email/company) + timestamp +
  `Qualified` badge (`goodsoft`/`good`). Selected row = `brandsoft` tint + `brand`
  left-border. New live session animates in at top (`dlFade`) and ticks the KPIs.
- **Session detail.** Summary paragraph → **replay player** (real Browserbase
  recording; flat frame, real controls, scrubbable) → transcript with search →
  right signals panel: **Snapshot / Buyer Signals / Opportunities / Decision
  Makers**, each a labeled group of compact rows.
- **Signal card** (room + session detail). One per `Note`: a small type glyph
  (interest=`good`, objection=`warn`, role/question=neutral), the value text, a
  mono timestamp. No card chrome beyond a hairline; let them stack as a feed.
- **User detail.** Buyer header (name/company/role) + enrichment + **scorecard**:
  lead score (mono, big, color by band), intent bar, objections, recommended
  follow-up in a single bordered block with one `brand` primary CTA. Cross-links to
  the session.
- **Ask bar (Overview).** A single input with mono placeholder + suggested-prompt
  chips (plain, `chip` bg). Answer renders as a calm text block, not a chat bubble.

---

## Self-check before shipping any screen

- [ ] One extrabold focal heading; the rest steps down.
- [ ] Indigo appears only as action/active/AI/one-series — no washes, no glow, no gradient.
- [ ] All data/numerals are mono.
- [ ] Status colors mean only their reserved thing.
- [ ] Default cards are hairline-bordered, shadowless; only overlays float.
- [ ] No decorative blob/halo/fake-logo-cloud/3-col-icon-grid.
- [ ] Warm neutrals carry the screen; color is earned.
