# Persona Research Brief (shared instructions for dogfooding-persona subagents)

You are grounding ONE dogfooding persona for **demoless** and writing it to its own file.

## What demoless is (the tool you're writing a test for)
demoless is an AI **voice agent** (persona name "Messi") that runs **live product demos** by
**driving a real cloud browser** (Browserbase) while it talks. A human tester comes in *as a
given persona*, states an intent out loud / in text, and **watches Messi navigate real websites**
end-to-end. The reference product being demoed is **Browserbase** (browser-automation infra for
AI agents). Dogfooding (GitHub issue #7) = run sessions as the persona and log (a) recurring
questions buyers keep asking and (b) agent breakdown points (wrong page, weak answer, dead air,
lost context, barrelled past a human-confirm gate).

So each persona = a realistic person with a recurring, multi-step, GUI-only/no-API web workflow
that a browser agent could run — grounded in real evidence — plus a manual telling a tester how
to *become* that persona and drive our tool through it.

## Research rules (grounding > volume)
- Cite **real URLs**: company blogs/case studies, **Hacker News via `hn.algolia.com/api/v1/...`**,
  dev.to, GitHub repos/issues, official docs, named press, vendor/community forums, vendor ToS pages.
- **reddit.com is hard-blocked in this environment.** Do NOT fabricate Reddit links/quotes. Cite
  HN/forums/press/GitHub instead, and where a complaint really lives on Reddit, name the subreddit
  and write "pull verbatim from a human browser — uncited here."
- Name **real** sites/tools/competitors with real URLs. Verify they exist. **Flag uncertainty
  instead of inventing.** Quote ToS verbatim when you make a ToS claim.
- Prefer "boring"/operational/recurring workflows with a clear before/after over flashy one-shots.

## Output: write ONE markdown file with the Write tool
Path: `docs/dogfooding/personas/<NN>-<kebab-slug>.md` (the dir exists; just Write the file).
Follow this template EXACTLY (headings in this order):

```
# <NN>. <Title> — <tag: `DEV` or `VERTICAL: <name>`>

## Persona
Specific person (name + context), the recurring manual pain, why it recurs.

## Inspiration & cited evidence
3–6 real complaints / case studies / tools, each with a URL and a one-line "what breaks".
Include the Reddit caveat if relevant. This is the "why this is real" section.

## Real targets
| Site | URL | Login? | Scrape/automation difficulty |
(name the real sites/portals/tools the agent would actually touch)

## Session flow
Numbered, concrete end-to-end browser steps on those real sites (what the agent navigates,
clicks, reads, extracts). Include where a human-confirm / MFA handoff belongs.

## Inputs / Outputs / Artifacts
What the persona supplies; what lands; the durable artifact.

## Friction / ToS / ethics flags
Why it's GUI-only/no-API; honest ToS / legal / ethics / privacy flags; recommended safe framing
(e.g. alert-don't-autosubmit, human-confirms-irreversible-action, sandbox-only).

## Testing manual — how to dogfood as this persona
- **Setup:** sandbox / throwaway accounts only; never real PHI, real bank creds, or real PII.
- **Intent you bring in:** 1–2 sentences, in character.
- **Session script:** ~6–10 beats — the exact things you say/ask Messi, and what you watch the
  browser do at each beat.
- **Probes:** edge cases to push (auth wall, CAPTCHA, mid-flow page change, ambiguous request,
  an irreversible action that should trigger a confirm).
- **Success criteria:** what "worked end-to-end" means (reached a real artifact or explicit dead-end).
- **Expected breakdown points to log:** where it'll most likely stumble.
- **What to record in `dogfooding-log.md`:** the recurring questions + breakdowns + replay link.
```

## Return value (keep SHORT — the detail goes in the file)
Return only: (1) the file path you wrote, (2) a one-line status, (3) your single biggest grounding
caveat. Do not paste the file contents back.
