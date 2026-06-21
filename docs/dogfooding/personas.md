# Dogfooding Personas + Session Flows (Issue #7)

Five grounded personas for end-to-end Browserbase dogfooding. **Every name, handle, URL,
competitor, and portal below is real and was verified via web research on 2026-06-21** —
the personas are illustrative people, but the sites/sources they touch are real, so a tester
can actually run these. Log findings in `dogfooding-log.md`.

Each spec: persona · real targets · session flow · artifact · friction/ToS flags.
Login-gated sites (X, LinkedIn, brokerage, MyChart) → **stage on sandbox/throwaway accounts**, never real PHI/credentials.

---

## 1. AI dev — daily X + RSS digest

**Persona.** Maya Chen, indie AI app developer (solo RAG-app studio). Can't doom-scroll X all day and still ship; wants one dated morning brief of what her trusted sources posted in the last 24h. No X API budget.

**Real targets (verified active):**
- X accounts: **@karpathy** (Andrej Karpathy), **@simonw** (Simon Willison), **@rasbt** (Sebastian Raschka), **@_akhaliq** (AK / HF Daily Papers), **@swyx** (Shawn Wang)
- RSS feeds (live, valid XML, built 2026-06-21): **Latent Space** `https://www.latent.space/feed` · **Ahead of AI** `https://magazine.sebastianraschka.com/feed`

**Session flow:**
1. Open pre-authenticated x.com profile (timelines are login-gated; pause for human on 2FA/"verify it's you").
2. For each of the 5 handles → visit `x.com/<handle>`, scroll-collect posts, **stop at >24h old**, skip pure RT/replies.
3. HTTP GET the 2 RSS feeds (no auth), parse items from last 24h.
4. Normalize + **dedup** (e.g. @rasbt tweeting his own Ahead of AI post → collapse to one, prefer newsletter URL).
5. Summarize, grouped by theme (releases / tooling / papers / commentary).

**Artifact:** `digest-2026-06-21.md` — themed sections + counts ("17 posts / 5 accounts / 2 newsletter items / 3 dupes merged").

**Friction / flags:** X has no free read API; profile timelines require login; heavily JS-rendered + anti-bot. RSS half is open by design (the contrast is the point). **ToS:** X scraping is fine for low-volume personal dogfooding, *not* for production; keep human-paced; never script through 2FA.
*Overlap note:* @rasbt↔Ahead of AI and @swyx↔Latent Space overlap on purpose (makes dedup meaningful). For fully disjoint sources, swap @swyx → **@JeremyPHoward**.

---

## 2. Trader — hourly GUI-only finance monitoring

**Persona.** Marcus Reyes, 41, independent retail macro/rates trader (Chicago; trades ZN/SOFR futures + ES). Edge = positioning around Fed policy + sentiment extremes. The canonical readings live in JS dashboards with no free API, so he tabs through 4 sites by hand hourly during the US session — exactly what he wants automated.

**Real targets (verified live; metric to read + alert rule):**
| Source | URL | Read | Alert |
|---|---|---|---|
| CME FedWatch | `cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html` | next-FOMC (Jul 28–29 2026) "no change" prob (3.50–3.75%) | move >5pts hr/hr, or cut prob crosses 50% |
| CNN Fear & Greed | `cnn.com/markets/fear-and-greed` | gauge value 0–100 + label | <25, >75, or moves >10 in an hour |
| AAII Sentiment | `aaii.com/sentimentsurvey` | weekly Bull/Neutral/Bear % | bull–bear spread <−10 or >+20 |
| Forex Factory | `forexfactory.com/calendar` | today's red USD events: actual vs forecast | any nonzero surprise on CPI/NFP/FOMC rows |

**Session flow:** hourly cron weekdays 08:00–16:00 CT → per source: navigate, wait for JS render, read the figure/table, compare to prev run + threshold, flag breaches → append to CSV, fire alert on any flag. No login needed to *read* any of the four.

**Artifact:** `readings.csv` (`timestamp, source, metric, value, prev, threshold, breached`) + `alerts.log` (breaches only).

**Friction / flags:** all four are JS-rendered (plain fetch fails — CME timed out, **CNN returns HTTP 451 to bots**) → needs a real browser. No free APIs (FedWatch's is paid). **ToS:** Forex Factory is the highest-risk (bot-averse); CNN's 451 is a deliberate block — keep to literally hourly, don't rotate UAs at scale. **Cadence honesty:** AAII is *weekly* (Thu AM) — hourly polling is wasteful; poll daily Thu–Fri instead.

---

## 3. Elderly patient — healthcare portal hand-holding

**Persona.** Margaret "Marge" Doyle, 74, retired teacher in Columbus OH, manages type-2 diabetes + hypertension, low tech-confidence. Caregiver daughter Susan (90 min away). Trigger: a "new test results available" notification + an appointment reminder. The agent + human-in-the-loop effectively stands in for Susan.

**Real target.** **Epic MyChart** (dominant portal: 200M+ accounts, 2025 Best in KLAS). Concrete instance e.g. Cleveland Clinic `my.clevelandclinic.org`. **For live dogfood use Epic's non-PHI sandbox/demo patient — never real PHI** (confirm current sandbox URL/creds at run time).
- Real IA labels (confirmed across health-system guides): top **"Menu"/"Your Menu"** → groups **"My Record"**, **"Communication"**; **Visits** (appointments), **Test Results** (My Record > Test Results), **Messages → Send a message → Medical Question**, **Medications**.

**Session flow (agent narrates every step in plain language):**
1. **Login (HITL):** open MyChart, enter user/pass; **pause and hand to human at the 2FA code** ("a 6-digit text just arrived, read it to me — it expires soon"). No credential/code storage.
2. **Visits** → read next appointment aloud, plain language.
3. **Test Results** → open newest, **translate jargon** ("HbA1c 7.8% = avg blood sugar ~3 months; target <7%, yours is a little high, not an emergency"), flag any High/Low.
4. **Messages → Medical Question** → select correct recipient (narrate PCP vs endocrinologist to avoid misroute), draft a short question, **show full draft and wait for explicit "yes, send"**.

**Artifact:** plain-language one-pager (appointment + each lab value explained + what was asked) + confirmation the message was sent (to whom, text, ~2-business-day reply window).

**Friction / flags:** no consumer API (FHIR patient-access is for registered OAuth apps, not an ad-hoc agent) → must drive the UI. HITL required for 2FA + the irreversible *send*. **Privacy:** HIPAA/PHI — sandbox only, no result/message logging to external services, explicit consent, model real **proxy access** (caregiver account) rather than password-sharing.
*This persona is the odd one out on purpose:* it tests **clarity / dead-air / hand-holding / takeover**, not raw automation — the richest source of "weak answer / lost context" findings.

---

## 4. B2B AE — pre-call account brief

**Persona.** Priya Mehta, Enterprise AE selling **Gong** (real revenue-intelligence SaaS, `gong.io`), NA mid-market/enterprise. Walks into calls with a researched POV; wants an agent to build the brief.

**Real target prospect.** **Commerce.com, Inc. (formerly BigCommerce; Nasdaq: CMRC)** — Austin, ~1,000–1,800 employees, ~$360M run-rate, public. Plausible Gong prospect: large sales-led motion + **new CRO (Rob Walter, early 2025)** + **rebrand to "agentic commerce" (Jul 2025)** = tooling-evaluation window.
- Real sources the agent visits: homepage `bigcommerce.com`, leadership `commerce.com/about/leadership/`, press `bigcommerce.com/press/`, IR `investors.bigcommerce.com`, **live Workday board** `bigcommerce.wd12.myworkdayjobs.com/Commerce` (filter AE/Sales/RevOps reqs), LinkedIn company `linkedin.com/company/bigcommerce/`, Crunchbase `crunchbase.com/organization/bigcommerce`.
- Real decision-makers: **Rob Walter (CRO** — economic buyer), **Michelle Suzuki (CMO** — influencer), VP Sales (champion, resolve at runtime).

**Session flow:** seed `{account, product: Gong, AE}` → fan out across the sources above → extract positioning, recent triggers, exec map, open-role counts, financials → synthesize 1-page brief (overview · triggers · decision-maker map · likely pains · outreach angle).

**Artifact:** the 1-page pre-call brief (each claim mapped to a source URL).

**Friction / flags:** **Crunchbase 403/paywall** (unauthenticated agent can't scrape — for a public co, SEC/IR pages substitute). **LinkedIn auth wall + ToS** (the biggest GUI-only friction; `/in/` profiles need a logged-in, ToS-aware session — Rob Walter's exact profile URL is intentionally left unverified). Workday board is JS-rendered (needs real browser). Marketing spine (`bigcommerce.com` + SEC/IR) is open and trustworthy; treat LinkedIn/Crunchbase as the gated frontier. *Mid-rebrand quirk:* `bigcommerce.com` vs `commerce.com` both resolve and cross-link.

---

## 5. SMB ops — competitor price/stock monitoring

**Persona.** Maya Restrepo, owner of "Cedar & Ember Coffee" — small-batch DTC roaster selling **12oz single-origin whole-bean bags** (flagship Ethiopia Yirgacheffe, $21). Wants an agent to check ~10 competitor single-origin pages every morning, read price + stock, diff vs yesterday, and ping her only on moves.
*Niche choice:* DTC coffee over salon/spa because roaster pages put a fixed price on a stable public URL, whereas Booksy/Vagaro bury per-stylist prices behind multi-step flows.

**Real targets (verified live 2026-06-21; price read that day):**
| # | Roaster | Product URL | Price |
|---|---|---|---|
| 1 | Counter Culture | `counterculturecoffee.com/products/apollo` | $20/12oz |
| 2 | Verve | `vervecoffee.com/products/banko-taratu` | $22/12oz |
| 3 | Stumptown | `stumptowncoffee.com/products/ethiopia-mordecofe` | $23/**10.5oz** |
| 4 | Stone Street | `stonestreetcoffee.com/products/ethiopian-yirgacheffe` | $24/**1lb** |
| 5 | George Howell | `georgehowellcoffee.com/products/worka-chelbessa-medium-ethiopia` | $26/12oz |
| 6 | Wonderstate | `wonderstate.com/products/ethiopia-natural-process` | $20/**8.8oz** |
| 7 | Bones | `bonescoffee.com/products/ethiopia-single-origin-12oz` | $19.99/12oz |
| 8 | Black & White | `blackwhiteroasters.com/products/the-original-1` | $21/12oz (was "unavailable" — good stock-flag test) |
| 9 | Intelligentsia | `intelligentsia.com/products/ethiopia-metad-alaka-washed` | **price JS-only** (not in raw HTML) |
| 10 | Onyx | `onyxcoffeelab.com/collections/ethiopia-coffees` | rotating/sells out (read live collection) |

**Monitoring rule:** normalize all to **$/oz** (sizes differ: 8.8 / 10.5 / 12oz / 1lb). Flag if vs prior run: price moves >10%, or $/oz < $1.60 (undercuts her $21 flagship), or stock flips, or page fails to load (surface silent breakage).

**Session flow:** daily 7am → per target: navigate, wait for price element (needed for JS sites like Intelligentsia), read title/price/size/stock → normalize $/oz → diff vs prior (keyed by URL) → log row → fire one digest only on rule hits.

**Artifact:** price-tracking sheet (one row/competitor/day) + change-alert digest.

**Friction / flags:** no price APIs; **Intelligentsia price is JS-only** (failed static fetch — the cleanest "needs a real browser" case); **Onyx/Sey rotate and sell out** (fixed slugs go stale → read collection page); non-uniform bag sizes force $/oz. **Anti-bot/ToS:** Shopify storefronts tolerate light human-paced reads but front some traffic with Cloudflare; respect robots.txt, one daily read/page, don't redistribute.
*Coverage note:* 8 of 10 have hard pinned 12oz-ish prices; #9 (JS) and #10 (rotating) are the realistic edge cases. To pin all 10 to a static price, swap #9/#10 for two more Shopify roasters.

---

# Round 2 — grounded in real community complaints (#6–#10)

These five were researched against real Reddit/HN/forum complaints + the tools people already hack together. **Caveat that applies to all five:** reddit.com was hard-blocked from the research environment (403), so verbatim r/ quotes could not be captured — the complaint *themes* are grounded in citable equivalents (Hacker News via the Algolia API, official ToS pages, named press, vendor forums) and the subreddits are named as "where to pull verbatim quotes from a human browser." Flagged per persona.

---

## 6. Job seeker — auto-fill applications across ATS + tracking

**Persona.** Priya Nair, mid-level SWE (~2 yrs), recently laid off; applying to **~25–40 roles/week** (grounded: ~30–45 min/app, avg ~32 apps → 4 interviews → 1 hire). Wants the form-filling tax gone.

**Real targets (ranked most→least painful, evidence-backed):**
- **Workday — most hated (strongest organic proof).** Separate account *per company*, re-type your resume *after* uploading it, multi-page wizards. HN verbatim: *"You will probably need a new email to create an account for each job application"*; *"you… are the product not the user."* A Medium walkthrough timed one app at **22m37s**.
- **Taleo** (voted worst ATS ~21%, Ladders), **Kenexa/BrassRing** (~14%), **iCIMS** (~13%) — all legacy, per-company accounts, long forms.
- **Indeed** (low apply-friction → floods recruiters), **LinkedIn Easy Apply** ("black hole"), **Greenhouse/Lever/Ashby** (the clean modern tier).

**How people hack it today:** Simplify Copilot (autofill 100+ boards, ~70% Workday accuracy), LazyApply (15–1500/day spray), JobRight, the `LinkedIn-Easy-Apply-Bot` (Selenium, selectors rot), AIHawk (29.9k★, **archived May 2026** — "pretends to apply," auto-DMs recruiters), Skyvern Jobs Agent (CAPTCHA reserved for paid cloud). Universal failure modes: wrong screening answers (visa/auth) silently disqualify whole batches; CAPTCHA hard-stops; selector rot.

**Session flow:** read posting → open application (handle Workday account gate) → upload resume + **correct the mis-parsed work-history rows** → fill dynamic fields → answer screening questions (auth/sponsorship/salary/EEO — the trust-critical step) → submit (CAPTCHA = human handoff) → log to tracker.

**Artifact:** N submitted applications + tracker (`Company | Role | ATS | URL | Date | Status | Resume version | Screening answers`).

**Friction / ToS / ethics:** no public *submit* API (Greenhouse's Boards API is read-only) → browser automation is the only path. **LinkedIn ToS §8.2 bans bots** verbatim (account-ban risk); **Indeed bans automating Indeed Apply** (§A.3.5). hiQ v. LinkedIn protects *public* scraping only — it does **not** cover logged-in apply automation (hiQ *lost* on breach-of-contract). **Ethics:** spray-and-pray degrades the pool — Greenhouse CEO: *"trust is at an all-time low"*, 65% of hiring managers caught AI-deceptive applicants; recruiters *"drinking through a fire hose."* → design as **assistive autofill with human review per submit**, not blind mass-apply. *Reddit (r/recruitinghell, r/cscareerquestions) uncited — pull verbatim from a human browser.*

---

## 7. Government appointment monitoring (alert-the-human, never auto-book)

**Persona.** Priya Nadkarni, 29, H-1B engineer in San Jose racing a visa stamp before an Aug 14 wedding in Pune — the Mumbai consulate shows the next slot ~300 days out, cancellations vanish in minutes. *(Safer happy-path demo persona: Marcus Reyes, Oakland, Global Entry interview before a Sept trip — cleanest because the slot API is public/read-only.)*

**Real targets:** CBP Trusted Traveler / Global Entry `ttp.cbp.dhs.gov` (auth via **Login.gov**), US visa `usvisascheduling.com`, `my.uscis.gov/appointment/v2`, CA DMV `dmv.ca.gov/portal/appointments/`.

**Real pain + tools:** Global Entry cancellation slots *"claimed within 90 seconds"*; visa interview waits **250–400 days**. Tools people use: `goes-notify`, `trusted-traveler-scheduler` (free, alert-only), **Appointment Scanner** ($29, ~25 alerts/day, explicitly *"does not book for you"*), `us-visa-bot` (some auto-rebook).

**Session flow:** configure program + centers + date window + poll interval → **human does the Login.gov sign-in** → throttled availability checks → on a hit, **alert the human immediately** (the primary artifact) → optional assisted-book that **pre-fills then pauses for explicit human "Confirm."** Never silently books, never resells.

**Artifact:** timestamped alert + (optional, human-confirmed) booked appointment + an audit log of every check (proves good-faith throttling).

**Friction / ethics (the loaded one):** **Login.gov flatly bans automation** verbatim ("for human interaction… users must access it manually") → the login step *must* be human. The **State Dept actively enforces**: US Embassy India cancelled **~2,000 bot-booked appointments and suspended accounts**; manipulating a visa system can get the *applicant's* visa refused/cancelled. Scalping is prosecuted (Miami-Dade DMV scalpers; a traveler paid $862 for a $25 SENTRI slot). Legal line: read-only, unauthenticated, throttled checking is low-risk (Van Buren/hiQ); **auto-booking crosses a login gate** and the enforced anti-bot clauses. **Default: alert-only + throttled + human books.** *(Reddit r/GlobalEntry, r/immigration uncited — env-blocked.)*

---

## 8. Personal-finance aggregation across bank portals (post-Mint)

**Persona.** Maya Okonkwo, 36, freelance UX consultant (S-corp) + spouse; money spread across **8 institutions** aggregators handle worst: Chase, Capital One, Navy Federal, AmEx Business, Charles Schwab, HSA Bank, Vanguard, an Illinois Bright Start 529. Ex-Mint power-user; tried Monarch but 3 of 9 connections kept dropping, so she's back to logging into 8 portals the first weekend of every month (~2 hrs she resents).

**Real pain (grounded in Tiller's "Known Data Feed Issues" wiki + Plaid/Monarch docs):** Mint died Jan 2024; Plaid connections break (`ITEM_LOGIN_REQUIRED`); **AmEx cross-files transactions under same last-4**; **Vanguard blocks aggregator IPs during market hours**; **Schwab killed OFX/Direct Connect**; HSA Bank/Betterment break on MFA. Real risk: **Fidelity/Schwab cut off or reset accounts linked to Pontera** — aggregator use can get you *locked out*.

**How people hack it:** Monarch, Copilot, Tiller (→ Google Sheets), Lunch Money / Actual (SimpleFIN), Firefly III, beancount — every path eventually dumps you back to "log into the portal and download the file." That manual step is the wedge.

**Session flow:** scheduled monthly, **runs locally on Maya's own logged-in browser profile** → per institution: login → **human handoff for MFA** → navigate to transactions/statements → download OFX/QFX/CSV (or scrape where no export) → local folder → normalize + dedup + auto-categorize → one consolidated ledger.

**Artifact:** a single consolidated, categorized transactions sheet (the thing Mint gave for free).

**Friction / security (P0-flavored — must be loud):** **never vault bank credentials** — drive the user's own session, credentials never leave the machine, MFA is human-in-the-loop, **data stays local**. Many bank ToS prohibit automated/third-party access (Wells Fargo & PNC ordered Trustly to stop screen-scraping); automated access can trigger lockouts/fraud holds. Frame as a personal, local monitoring assistant; CFPB Rule 1033 open-banking is the sanctioned long-term path. *(Reddit r/personalfinance, r/plaid uncited — env-blocked; grounded via Tiller forum + Bogleheads + Plaid docs instead.)*

---

## 9. Apartment hunting in a hot market (first-to-contact)

**Persona.** Priya Raman, 28, relocating Boston→SF for a SWE job with a **hard 4-week deadline** (corporate housing ends day 14). Targets Mission / Bernal / Lower Haight, **1BR ≤ $3,400**, cat-friendly. Remote in Boston, so by the time Zillow's morning digest arrives the good units have multiple inquiries — she wants to be first to email.

**Real targets + difficulty:** **StreetEasy** (dominant NYC; **PerimeterX/HUMAN anti-bot confirmed** — JS challenge, press-and-hold CAPTCHA, blocks datacenter IPs), **Zillow** (dominant SF/Bay; aggressive anti-bot), **Craigslist** `sfbay.craigslist.org/search/apa` (easier but scam-dense), **HotPads**, **Apartments.com**, **Zumper/RentHop/PadMapper** (carry open listings — *~2/3 of NYC rentals never hit StreetEasy*).

**Real pain + tools:** *"listings vanish hours after posting"*; native saved-search emails are batched/slow and **silently break** (StreetEasy + Zillow both have documented alert failures); scams/duplicates; NYC broker fees (FARE Act, Jun 2025). Tools: native alerts (too slow), the `VikParuchuri/apartment-finder` Slack bot (real Boston→SF use case), `flathunter`, Apify StreetEasy/Zillow scrapers (need residential proxies), n8n workflows.

**Session flow:** every ~15 min → open saved searches (newest-first) → read the rendered results list → diff vs last run's IDs → scam/dup filter → **alert the human immediately** with link + time-since-post → **draft (not send)** a one-tap inquiry message.

**Artifact:** instant new-listing alerts + a pre-drafted, ready-to-approve outreach message per match.

**Friction / ToS:** no renter-facing API; StreetEasy/Zillow ToS prohibit scraping and are aggressively anti-bot → **prefer the lowest-friction sources (Craigslist, Zumper, RentHop) for the automated leg** and treat StreetEasy/Zillow as human-in-the-loop "open the saved search and skim." **Alert + draft, never auto-submit.** *(Reddit r/nyc, r/bayarea uncited — env-blocked; grounded via StreetEasy forum, FirstMover, BrickUnderground.)*

---

## 10. Local business — online review monitoring + drafted responses

**Persona.** Sofia Marín, owner of a 2-location independent restaurant; reviews land daily across **Google, Yelp, Facebook, and TripAdvisor** and she can't watch four dashboards while running service — she misses reviews and responds late, which hurts ranking and lets the occasional fake/competitor review sit unanswered.

**Real targets:** Google Business Profile / Google Maps, Yelp, Facebook/Meta, TripAdvisor. **Why browser-agent:** Yelp restricts/closed its Fusion API and prohibits scraping; Google's API is gated — so reading the dashboards like a human is the practical path for a small owner. Paid all-in-one tools exist (Birdeye, Podium, NiceJob, GatherUp, Reputation.com) but owners complain they're **expensive** and still miss platforms.

**Session flow:** daily run → open each platform → find **new reviews since last run** → extract rating + text + reviewer → flag negatives → **draft a tailored response** per review for the owner to approve before posting.

**Artifact:** a daily review digest + draft responses (human approves posting).

**Friction / ToS:** Yelp prohibits scraping and discourages automating/soliciting reviews; platform automation rules vary → **draft-not-autopost + human review** is the safe design. *(⚠️ **Least-grounded of the ten:** the research agent got stuck on env-blocked Reddit and was stopped; target platforms and named tools are real, but verbatim owner complaints weren't captured — pull from r/smallbusiness via a human browser before treating quotes as cited.)*

---

## Cross-persona design (why this set finds bugs)

Ten personas spanning the axes that surface failures:
- **Automation-heavy** (#1,#2,#4,#5,#6,#8,#9,#10) **vs hand-holding** (#3, and the human-confirm gates in #6/#7/#8).
- **One-shot** (#3,#4) **vs recurring/scheduled** (#1,#2,#5,#7,#8,#9,#10).
- **Public sites** (#5,#9 partly) **vs login-gated** (X, brokerage, MyChart, LinkedIn, Login.gov, banks, ATS portals).
- **Pure automation vs irreversible-action-with-approval** (#6 submit, #7 book, #8 bank access, #10 post) — the personas where the agent must **stop and ask** are the richest source of "barrelled past the human / lost context" findings.

The login + JS-render + anti-bot friction is deliberately concentrated so dogfooding stresses auth handoff, dynamic rendering, recovery, and the human-confirm gates — the exact moments to log as breakdowns.

> **Global research caveat:** reddit.com was unreachable from the research environment (hard 403), so Round-2 complaint *themes* are grounded in Hacker News, official ToS pages, named press, and vendor forums rather than verbatim r/ permalinks. Before any of these go in front of a customer, pull the matching Reddit quotes from a human-controlled browser.
