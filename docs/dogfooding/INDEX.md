# Dogfooding Persona Library — Index (30 workflows)

30 grounded, end-to-end browser-agent workflows for dogfooding demoless (GitHub issue #7).
Each is a real recurring, GUI-only/no-API workflow with cited inspiration **and** a testing
manual (how to role-play the persona and drive our agent through it).

**How to use:** pick a persona → read its file → run it as a session against the demo (come in
in-character, state the intent, watch Messi drive the browser) → log recurring questions + breakdown
points in [`dogfooding-log.md`](dogfooding-log.md). Shared instructions for writing more:
[`persona-research-brief.md`](persona-research-brief.md).

- **#1–#10** live in [`personas.md`](personas.md) (rounds 1–2).
- **#11–#30** are individual files in [`personas/`](personas/).
- Tag `DEV` = engineer/developer workflow (~13 of 30, ≈43%). Others tagged by vertical.

| # | Role / persona | Tag | One-line workflow | File |
|---|----------------|-----|-------------------|------|
| 1 | AI developer | `DEV` | Daily digest from 5 X accounts + 2 RSS newsletters | personas.md |
| 2 | Retail macro trader | finance | Hourly read of 4 GUI-only finance dashboards, alert on thresholds | personas.md |
| 3 | Elderly patient | healthcare | Hand-held MyChart: appointments, lab results in plain English, message doctor | personas.md |
| 4 | B2B account exec | sales | Pre-call account brief fanned across company site, LinkedIn, news, filings | personas.md |
| 5 | DTC coffee roaster (SMB) | ecommerce | Daily competitor price/stock monitoring across 10 roaster sites | personas.md |
| 6 | Job seeker (SWE) | careers | Auto-fill applications across ATS (Workday etc.) + tracker | personas.md |
| 7 | Visa/Global-Entry applicant | gov | Monitor appointment slots, alert-the-human (never auto-book) | personas.md |
| 8 | Freelancer (post-Mint) | fintech | Monthly transaction pull across 8 bank/brokerage portals → one ledger | personas.md |
| 9 | Relocating renter | real-estate | Every-15-min new-listing monitor + drafted outreach, first-to-contact | personas.md |
| 10 | Local restaurant owner | SMB | Daily review monitoring across Google/Yelp/FB/TripAdvisor + draft replies | personas.md |
| 11 | QA / test engineer | `DEV` | Nightly cross-browser regression smoke of login/checkout/signup flows | personas/11-qa-regression-smoke.md |
| 12 | SRE / on-call | `DEV` | Monitor vendor status pages + SSO-gated dashboards, "is it us or them?" | personas/12-sre-statuspage-monitor.md |
| 13 | AI/ML engineer | `DEV` | Compare model outputs across web playgrounds + watch leaderboards | personas/13-ml-eval-leaderboard.md |
| 14 | OSS maintainer / DevRel | `DEV` | Triage GitHub issues + monitor mentions + cross-post a release | personas/14-oss-maintainer-triage.md |
| 15 | Data engineer | `DEV` | Recurring login/JS-gated scrape into an internal dataset (ETL fallback) | personas/15-data-engineer-etl-scrape.md |
| 16 | Indie hacker / solo SaaS | `DEV` | Launch-day + competitor monitoring (Product Hunt, HN, app stores) | personas/16-indie-hacker-launch-monitor.md |
| 17 | AppSec / security engineer | `DEV` | Daily CVE/advisory sweep across NVD/GHSA/OSV + vendor PSIRT bulletins | personas/17-security-cve-monitor.md |
| 18 | Growth / SEO engineer | `DEV` | SERP rank + competitor + Search Console monitoring (+ refusal gate) | personas/18-seo-rank-monitor.md |
| 19 | Solo founder / CTO | `DEV` | SaaS vendor due-diligence: pricing/SOC2/status/docs across many sites | personas/19-founder-vendor-diligence.md |
| 20 | Data / ops analyst | `DEV` | Scheduled report/CSV-export pulls from no-API dashboards (Stripe, ads) | personas/20-analyst-report-pulls.md |
| 21 | Mobile / app developer | `DEV` | App-store review + ranking monitoring across App Store Connect / Play | personas/21-appstore-review-monitor.md |
| 22 | Auto-repair shop owner | auto-repair | Cheapest-in-stock parts sourcing across 5 supplier portals per job | personas/22-auto-repair-parts-sourcing.md |
| 23 | Salon / spa owner | salon/spa | Competitor service-price + booking-availability monitoring (Booksy/Vagaro) | personas/23-salon-spa-competitor-pricing.md |
| 24 | Restaurant owner | restaurant | Food-cost monitoring + reorder across distributor portals (Sysco/US Foods) | personas/24-restaurant-food-cost-monitor.md |
| 25 | Real-estate agent | real-estate | Pull comps + new listings across MLS/Zillow/Redfin → CMA | personas/25-real-estate-comps-cma.md |
| 26 | Technical recruiter | recruiting | Candidate sourcing across LinkedIn/GitHub/boards + outreach | personas/26-recruiter-candidate-sourcing.md |
| 27 | Amazon/Shopify seller | ecommerce | Buy Box / competitor / review / inventory monitoring in Seller Central | personas/27-ecommerce-seller-buybox-monitor.md |
| 28 | Paralegal / legal ops | legal | Court-record + case-status pulls across county portals + PACER | personas/28-paralegal-court-records.md |
| 29 | Nonprofit grants manager | nonprofit | Grant-opportunity + deadline monitoring (grants.gov + foundations) | personas/29-grants-opportunity-monitor.md |
| 30 | Academic researcher | academia | Journal-TOC / citation-alert / CFP monitoring → literature digest | personas/30-academic-paper-monitor.md |

## What recurs across the set (design notes for dogfooding)

- **The hero shot is parallel fan-out** (#4, #5, #8, #22, #25) and **recurring/scheduled runs** (#1, #2, #9, #11, #12, #17, #29, #30).
- **Human-confirm / irreversible-action gates** (#6 submit, #7 book, #8 bank access, #10/#21 post, #22 buy) are the richest source of "barrelled past the human" findings.
- **Refusal-and-redirect** is itself a test: #18 (SEO live-rank) has no ToS-compliant path — the right behavior is for the agent to *decline and offer a clean alternative*.
- Login + JS-render + anti-bot friction is concentrated so dogfooding stresses auth handoff, dynamic rendering, recovery, and the confirm gates.

## Known cleanup (not yet done)

1. **Persona-name collisions.** Round-2 agents independently reused first names — "Priya" recurs ~9× (e.g. four personas named **"Priya Raman"**: #12, #13, #18, #19), plus "Okafor" (#21, #22, #27, #29) and "Dana" (#25, #27, #29). Round-1 also used **"Messi"** as a persona name (#1, #5, #8) which collides with the **agent's own name (Messi)**. Names are cosmetic and each file is self-contained, but a dedup pass (one distinct name per persona, none named "Messi") is pending.
2. **Reddit citations.** reddit.com was hard-blocked from the research environment, so the sharpest first-person complaints (named subreddits per file) are **uncited** — grounded instead in HN/dev.to/GitHub/press/vendor forums. Pull verbatim Reddit quotes from a human browser before any of these face a customer.
3. **Per-file runtime flags** to verify before relying on a workflow: each file's "biggest caveat" (e.g. swap in a confirmed vendor advisories page for #17; verify exact AutoZone Pro login URL for #22; #20/#27 collide with platform anti-automation ToS → keep read-and-alert, sandbox-only).
