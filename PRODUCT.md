# Product

## Register

product

## Users

**Primary: B2B sales teams** — reps, sales engineers, and founders running a
pipeline. Their context is post-call or between-calls: they need to know fast
whether a buyer is worth chasing and what to say next. They live in dashboards
and CRMs all day, so the bar is *instrument-grade* — dense, scannable, trustworthy
at a glance, never a marketing page.

**Secondary: the prospect being demoed to** — the buyer who lands in the live
demo room. They experience Demoless as an AI rep that walks them through a product
(currently **Browserbase**) over chat/voice with a live browser on screen. Their
job: understand the product without booking a human call. Demoless watches this
conversation and turns it into the intelligence the primary user consumes.

The job to be done: **turn an unattended product demo into a scored, evidenced
read on the buyer** — so a sales team knows who's qualified, what they objected
to, and how to follow up, without a human having sat the call.

## Product Purpose

Demoless is an AI agent that demos a product to a prospect (chat/voice + a live
browser) and, while doing it, extracts buyer intelligence. The agent runs a
HOOK → DISCOVERY → WALKTHROUGH → CLOSE arc, remembers returning buyers across
sessions, and emits structured signals (interest, objection, role, decision-maker)
that roll up into a dashboard: KPIs, session replays, per-buyer scorecards, and
follow-up recommendations.

Today the demoed product is **Browserbase** (the agent's knowledge base sells
Browserbase to the prospect). The architecture keeps the demoed product behind a
swappable KB seam, but Browserbase is the committed target — not a placeholder.

Success looks like: a sales team opens the dashboard after a buyer self-served a
demo and trusts the read — score, evidence, and next step — enough to act on it
without re-watching the call.

## Brand Personality

**Serious, fast, precise.** The one line that governs everything (from DESIGN.md):
*"Serious, fast software that turns a conversation into intelligence."* The feel
is **warm technical editorial** — Stripe's warmth × Linear's precision. Confident
and earned, never decorative or hype-y. Color shows up as *data and state*, not
ornament; numbers are monospaced so the product reads like an instrument.

Voice: direct, evidence-first, no marketing fluff. We show the signal and its
timestamp rather than asserting the adjective.

## Anti-references

The de-slop mandate is the canonical list (see DESIGN.md). The product must never
read "a bit AI." Explicitly avoid:

- Default violet-indigo hero fills, indigo-washed panels, gradient tiles.
- Decorative gradients, blobs, glow-rings, pulse halos.
- Template tropes: 3-column icon-square feature grids, fake-logo clouds,
  centered-everything heroes, "3×" brag testimonial cards as decoration.
- Soft-everything: pillowy radii, ambient drop-shadows on flat cards.
- Generic SaaS dashboard chrome: rainbow charts, big-gradient KPI hero metrics,
  chat-bubble UI where a calm text block would do.

## Design Principles

1. **Practice what you preach.** Demoless sells competent AI; the product itself
   must feel like competent AI. The demo experience *is* the pitch — sloppiness
   here is a sales objection.
2. **Show the evidence, not the adjective.** Every claim about a buyer (score,
   intent, objection) is backed by a signal and a timestamp. The design surfaces
   the evidence, not just the verdict.
3. **Precise and earned, never decorative.** If an element doesn't carry
   information or hierarchy, it comes out. Space and a hairline beat an indigo wash.
4. **The instrument, not the brochure.** The dashboard reads like an instrument —
   dense, mono numerals, scannable. Marketing breathes; the app is tight.
5. **Live is the hero.** The live thing (speaking now, streaming, a session
   arriving) earns the attention and the motion. Motion confirms state; it never
   loops for ambiance.

## Accessibility & Inclusion

**Target: WCAG 2.1 AA.**
- Body text ≥4.5:1 contrast; large text ≥3:1. Watch muted-gray-on-warm-paper —
  bump toward `ink` when close.
- Status meaning never carried by color alone (interest/objection/danger also
  use glyph + label), so the read survives color-blindness.
- Every animation (speaking pulse, REC blink, progress, session fade-in) needs a
  `prefers-reduced-motion: reduce` alternative.
- Keyboard navigable: dashboard rows, range toggles, replay controls, ask bar.
