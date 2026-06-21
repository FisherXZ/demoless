# 20. Data / Ops Analyst: Scheduled Report & Export Pulls — `DEV`

## Persona
**Priya, a marketing-ops analyst at a 9-person performance agency.** Every Monday she rebuilds the
prior-week client reports. There is no single source of truth: she logs into Google Ads, Meta Ads
Manager, and the client's Stripe account, opens the relevant *dashboard view* in each, sets the date
range and column set, clicks **Export → CSV**, downloads the file, and then hand-merges the CSVs into a
master spreadsheet that feeds the client slide. Six clients × three-to-five sources = ~20 manual
export-and-stitch passes before noon.

Why it recurs: the *pre-built dashboard report* (the exact columns, segments, and date framing she
needs) is GUI-only. The platforms have APIs, but the API returns raw objects/rows, not the curated
dashboard view — so reproducing the report programmatically means re-implementing each platform's
reporting logic and chasing OAuth, scopes, and rate limits for every client account. Manual export is
genuinely faster per-run than maintaining that pipeline, so the weekly hand-pull never dies. She is a
textbook GUI-only-export workflow that a browser agent could drive end-to-end.

## Inspiration & cited evidence
- **Show HN: ChartStud** — founder describes the exact loop: *"Export CSVs from Google Ads / Export
  CSVs from Meta / Clean data manually / Build charts in spreadsheets / Turn it into a report for
  clients."* The product exists *because* this manual pull was the weekly reality.
  https://news.ycombinator.com/item?id=46105729 (and comment by `lahcenassm`,
  https://news.ycombinator.com/item?id=47599925). What breaks: per-platform manual export + manual
  cleaning before any client report exists.
- **Stripe dashboard ≠ public API** — *"The dashboard API … is not a public-facing API and there's no
  short-term intention to make it public-facing, so one has to build an ugly workaround."*
  https://news.ycombinator.com/item?id=31425288 . What breaks: dashboard views/actions aren't all
  exposed via the documented API, so people fall back to the GUI.
- **Same gap, second example** — multiple invoice emails *"works in the dashboard, but blocked in the
  public API."* https://news.ycombinator.com/item?id=31425531 . What breaks: dashboard-only feature,
  no API parity.
- **Plan creation is dashboard-only** — *"There is no API way to dynamically create a plan which you
  haven't hardcoded manually in the console."* https://news.ycombinator.com/item?id=14992007 . What
  breaks: console/dashboard is the only path for some operations.
- **Industry sizing** — agency-reporting vendors document the pain at scale: analysts spend ~10–15
  hrs/week on manual reporting and run ~5–12 data sources per client, each with its own login and
  export format. https://improvado.io/blog/agency-reporting-automation and
  https://funnel.io/blog/marketing-agency-reporting-tools . What breaks: fragmented logins/formats,
  data stale before the report ships. (These are vendor blogs selling automation — directional, not
  neutral.)
- **Reddit caveat:** the rawest "I export 20 CSVs by hand every Monday" venting lives in
  r/PPC and r/agency — pull verbatim from a human browser; **uncited here** (reddit is blocked in
  this environment, links not fabricated).

## Real targets
| Site | URL | Login? | Scrape/automation difficulty |
|---|---|---|---|
| Google Ads (Reports / campaign view → Export) | https://ads.google.com | Yes (Google OAuth, often MFA) | Hard — heavy SPA, "Download → CSV" menu, account switcher per client |
| Meta Ads Manager (Reports → Export table data) | https://adsmanager.facebook.com | Yes (Meta, MFA + frequent re-auth) | Hard — SPA, modal export dialog, aggressive bot/anti-automation checks |
| Stripe Dashboard (Payments / Payouts → Export) | https://dashboard.stripe.com | Yes (email + MFA) | Medium — clear "Export" button, but MFA wall + financial data sensitivity |
| Google Sheets (the master/consolidation sheet) | https://docs.google.com/spreadsheets | Yes (Google) | Easy — paste/import target; the durable artifact lands here |

## Session flow
1. Navigate to Google Ads, land on the correct **client account** (account switcher — the agent must
   pick the right one, a common slip).
2. Open **Reports** (or the campaign table), set date range to *last week*, confirm the column preset.
3. Click **Download → CSV**; capture the file. Read back the row count + total spend so the human can
   sanity-check.
4. Switch to Meta Ads Manager → same client → **Reports / table → Export → Export table data (.csv)**;
   download.
5. Switch to Stripe Dashboard → **Payments** (or **Payouts**) → set date range → **Export** → CSV.
   *(MFA handoff almost certainly fires here — see flags.)*
6. Open the client's master **Google Sheet**; append/paste each export into its source tab; normalize
   the date column.
7. Read back a consolidated summary (spend, conversions, revenue per source) and surface any
   source whose totals look anomalous vs. last week.
8. **Human-confirm gate:** before overwriting last week's tab or sharing the sheet, pause and ask the
   tester to confirm — overwrite is destructive.

## Inputs / Outputs / Artifacts
- **Supplies:** which client, which date range, the list of sources, the master-sheet URL, and live
  auth (the human completes each login/MFA — the agent never holds long-lived credentials).
- **Lands:** one normalized CSV per source + a populated source tab in the master Google Sheet.
- **Durable artifact:** the consolidated weekly Google Sheet (the thing that feeds the client slide),
  plus a short text recap of per-source totals and any anomaly flags.

## Friction / ToS / ethics flags
- **Why GUI-only / no usable API:** the *curated dashboard report* (exact columns/segments/date framing)
  is not what the APIs return — APIs expose raw objects and require per-account OAuth, scopes, and
  rate-limit handling, so reproducing the dashboard view programmatically is more work than the manual
  export it replaces (grounded in the Stripe dashboard-vs-API comments and the ChartStud workflow).
- **ToS — automating logged-in ad platforms is the sharp edge.** Meta's Platform Terms and automation
  rules restrict automated access/scraping of its products; Google Ads and Stripe similarly govern
  programmatic/automated access. Treat agent-driven navigation of these logged-in surfaces as
  **ToS-gray** and demo only against **own/sandbox accounts**. Quote the specific clause verbatim from
  each vendor's live ToS before making any compliance claim in a real session — not paraphrased here.
- **Financial + client-PII data** flows through the Stripe step. Sandbox/test-mode accounts only; never
  real customer payment data.
- **Safe framing:** read-and-export only; **alert-don't-autosubmit**; **human-confirms any
  overwrite/share** of the consolidation sheet; **MFA always handed back to the human**; sandbox-only.

## Testing manual — how to dogfood as this persona
- **Setup:** Google Ads **test/manager** account, Meta Ads **sandbox**, Stripe **test mode**
  (`dashboard.stripe.com/test`), and a throwaway Google Sheet. No real client data, no real PII, no
  real card data. *(Note: the reference product being demoed is **Browserbase**; this persona is the
  generic ops-analyst flow you drive Messi through — substitute the demo target's own dashboards if the
  session is meant to showcase Browserbase's site specifically.)*
- **Intent you bring in:** *"It's Monday — pull last week's numbers for Client A from Google Ads, Meta,
  and Stripe, and drop them into my weekly sheet so I can build the client report."*
- **Session script (beats):**
  1. *"Open Google Ads and switch to the Client A account."* — watch the account switcher; confirm it
     lands on the right account, not the agency MCC default.
  2. *"Set the date range to last week and export the campaign report as CSV."* — watch the date picker
     and the Download → CSV menu.
  3. *"Tell me the total spend and row count from that file."* — watch it read the export back.
  4. *"Now do the same in Meta Ads Manager — export the table data."* — watch for the export modal and
     any re-auth prompt.
  5. *"Now Stripe — export last week's payments."* — **watch the MFA wall**; confirm Messi pauses and
     hands off rather than guessing.
  6. *"Paste all three into the Client A master sheet, one tab each."* — watch the consolidation.
  7. *"Summarize spend / conversions / revenue per source and flag anything weird vs. last week."*
  8. *"Overwrite last week's tab with this."* — **this must trigger a confirm**, not a silent write.
- **Probes:** wrong account selected (does it notice?); MFA wall on Stripe (handoff vs. dead air);
  Meta export dialog changes shape mid-flow; ambiguous "last week" (calendar vs. trailing 7 days — does
  it ask?); the irreversible overwrite (step 8 must gate).
- **Success criteria:** all three CSVs exported, normalized into the sheet, a correct per-source recap
  read back, and the overwrite gated on human confirm — *or* a clean explicit dead-end ("Stripe MFA
  needed, handing to you").
- **Expected breakdown points to log:** picks the wrong client account; barrels past the Stripe MFA
  gate (dead air or guess); mis-maps export columns when stitching into the sheet; silently overwrites
  the master tab; loses which client it's on across the three platform switches.
- **What to record in `dogfooding-log.md`:** recurring buyer questions (e.g. "can it remember my column
  preset / date convention?", "does it hold logins across sources?", "what happens at MFA?"); breakdown
  points above; and the session replay link.
