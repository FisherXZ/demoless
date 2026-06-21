# Browser-Agent End-to-End Workflows — Demo-Script Research Report

**Date:** 2026-06-21
**For:** demoless — staging realistic, end-to-end browser-agent demos (current demo target: Browserbase)
**Question:** Find 5–10 *coherent* user stories where a real person/company replaced a recurring **manual, multi-step browser task** with an AI browser agent — before/after, step-by-step flow, real value. Boring/operational workflows preferred over "book a flight" toys.

> **Method & confidence.** Produced by the deep-research harness (6 search angles → ~18 fetched sources → 3-vote adversarial verification per claim), **stopped before the auto-synthesis phase** and synthesized here by hand from the verified findings. Almost every claim below survived adversarial verification at *high* confidence. The few exceptions are flagged inline. Hard ROI numbers are mostly **vendor-reported** (case studies / use-case pages) — treat them as marketing-grade, not audited. Two claims were *refuted* in verification and are corrected below.

---

## Executive summary

There is one repeating pattern across every credible source, and it *is* the demo:

> A knowledge worker logs into **many different web portals that have no API**, re-keys the **same data** into each, handles **logins / 2FA / CAPTCHAs**, downloads or submits something, and does this **on a recurring cadence**. A browser agent runs the whole fan-out in parallel, survives portal redesigns (vision/LLM, not brittle selectors), and produces a **verifiable artifact** (audit trail, screenshots, renamed PDFs, a brief).

That's the spine of a great demoless demo: *one input → agent fans out across N hostile portals → structured output + replay you can watch.* The "boring" verticals (insurance, healthcare, tax, AP/finance, compliance) are stronger demos than consumer tasks precisely because the manual pain is large, recurring, and quantified.

### The 10 workflows, ranked for demo-fit

| # | Workflow | Vertical | Who built it | Before → After | Demo appeal |
|---|----------|----------|--------------|----------------|-------------|
| 1 | **Multi-carrier insurance quoting** | Insurance ops | Skyvern | 4–6 hrs across 15–40 portals → ~10–20 min | ★★★★★ parallel fan-out is visually stunning |
| 2 | **Healthcare prior authorization** | Healthcare ops | Skyvern (+ Optexity) | 16–24 min/req → 2–5 min; 50+ in parallel | ★★★★★ audit-trail artifact = compliance story |
| 3 | **B2B sales account research** | Sales/GTM | Aomni (on Browserbase) | ~3 hrs/prospect → minutes; ~40% close lift | ★★★★★ directly mirrors demoless's own use case |
| 4 | **Finance receipt + procurement** | Finance ops | Ramp (on Browserbase) | hours of receipt entry → auto; 30k hrs/mo reclaimed | ★★★★★ named PM, huge numbers |
| 5 | **Pharmacy invoice retrieval** | Pharmacy AP | Skyvern | 10+ hrs/mo across 6 PBM/wholesaler portals → minutes | ★★★★ concrete named portals |
| 6 | **Multi-state sales-tax filing** | Tax/compliance | Numeral (on Browserbase) | manual logins to 48+ state portals → managed | ★★★★ recurring cadence; see caveat |
| 7 | **Hospital nurse-license verification** | Healthcare HR | Commure-style (Browserbase) | per-shift manual checks → nightly 50-portal sweep | ★★★★ scheduled + alerting story |
| 8 | **Hospital claims reconciliation** | Healthcare RCM | Commure "Scout" (Browserbase) | manual claim chasing → 20x/day, 8k hrs saved | ★★★★ HIPAA replay artifact |
| 9 | **Bank/fintech KYC onboarding** | Fintech compliance | Parcha (on Browserbase) | ~1 hr/business → ~10 sec/prospect | ★★★ dramatic time-collapse |
| 10 | **High-volume job applications** | Recruiting | Skyvern Jobs Agent | hours re-filling forms → hundreds concurrent | ★★★ relatable; **ToS caveat** |

**If you only build three demos:** #1 (insurance quoting — the parallel fan-out), #3 (sales research — it's literally what demoless does), and #2 (prior auth — the compliance/audit-trail artifact closes enterprise buyers).

---

## How to read these as demo scripts

Each workflow below is structured for direct staging:
- **Persona** — who's in the demo
- **Manual pain (before)** — the cold-open you dramatize
- **Agent flow** — the literal step sequence + named target sites
- **Inputs / Outputs / Artifacts** — what the user supplies, what lands
- **Why it's end-to-end** — why this beats a one-shot lookup
- **Source / confidence**

---

## 1. Multi-carrier insurance quoting  ★★★★★

- **Persona:** Independent insurance agent / agency ops staff managing 15–40 carrier portals.
- **Manual pain (before):** Staff spend **2–4 hrs/day** re-typing identical client data (named insured, revenue, employee count, coverage) into each carrier's portal *one at a time*; quoting 15 carriers sequentially takes **4–6 hrs**. Every portal has a different UI and breaks scripts on redesign.
- **Agent flow:** One client-info JSON triggers **~20 carrier portal sessions in parallel** → log in (TOTP/2FA + CAPTCHA handled natively) → fill the multi-page quote wizard on each (Hartford, Travelers, Progressive, Nationwide, Liberty Mutual, Chubb…) → wait for quote generation → extract structured result (quote #, premium, effective date).
- **Inputs / Outputs / Artifacts:** *In:* one client profile. *Out:* side-by-side comparison of quotes. *Artifacts:* declarations pages / COIs / loss runs auto-downloaded, renamed to a convention (`Client_Carrier_DocType_Date.pdf`), pushed into the agency-management system. Also handles **mid-term endorsements** (update drivers/limits, submit, download revised dec page).
- **Why end-to-end:** 6-hr sequential process → **under 20 min**; enables "same-day quotes every time." Recurring daily, not a lookup.
- **Source:** Skyvern — `skyvern.com/blog/automate-insurance-carrier-portal-workflows/` (verified high; "4 hrs → 10 min", "40% more opex for manual" are vendor figures).

## 2. Healthcare prior authorization across payer portals  ★★★★★

- **Persona:** Clinical staff / practice administrator handling prior auths across 10–40+ payer portals.
- **Manual pain (before):** Physicians spend **13 hrs/week on ~39 PA requests**; **93%** report PA delays harm patient care; each portal request takes **16–24 min** manually. Only **31%** of PA tasks are fully electronic.
- **Agent flow:** (1) authenticate to payer portal (stored creds + MFA/TOTP/CAPTCHA, manage 5–30 min session timeouts); (2) eligibility check on **UHC / Cigna / Aetna / Humana / BCBS / Availity** — enter member IDs, extract coverage + formulary; (3) submit multi-page PA form, mapping clinical data to *payer-specific* fields, upload physician notes/labs/imaging; (4) scheduled status tracking; (5) **human pre-submission review gate**.
- **Inputs / Outputs / Artifacts:** *In:* clean JSON payload (patient DOB/member ID, prescriber NPI, CPT/HCPCS + ICD-10 codes, clinical docs). *Out:* authorization number + status. *Artifact:* **full audit trail with screenshots / video replay** (the compliance money-shot).
- **Why end-to-end:** 16–24 min → **2–5 min/request**, **50+ submitted in parallel**. Independent corroboration (Optexity): AR days **137 → 70**, **27%** lower collection costs.
- **Sources:** Skyvern — `skyvern.com/blog/automate-healthcare-prior-authorization-insurance-portals/`; Optexity — `optexity.com/blog/automating-prior-authorization-and-eligibility-verification-across-payer-portals` (verified high, multi-source).

## 3. B2B sales account research  ★★★★★  *(mirrors demoless's own use case)*

- **Persona:** B2B account executives doing pre-call research.
- **Manual pain (before):** **~3 hrs of manual research per prospect** across many sites; reps spend only **30–40%** of time selling, the rest on CRM/prospecting/research.
- **Agent flow:** On a lead trigger, fan out parallel browser sessions to: **homepage, careers page, press releases, LinkedIn, funding databases (Crunchbase/PitchBook), product docs, competitor sites** → extract ~**1,000 data points/account** → synthesize.
- **Inputs / Outputs / Artifacts:** *In:* a target account. *Out:* a structured brief (company overview, decision-maker map, pain points/buying triggers, competitive positioning) **+ per-stakeholder 1:1 email/LinkedIn sequences**, delivered "before the call starts."
- **Why end-to-end:** Multi-site aggregation no human does by hand; ~**40% close-rate lift** (vendor); customers include Nvidia/AMD; Aomni raised $4M.
- **Sources:** Browserbase case study `browserbase.com/blog/case-study-aomni`; VentureBeat `venturebeat.com/ai/aomni-...` (verified high).

## 4. Finance receipt collection + procurement due diligence  ★★★★★

- **Persona:** Finance / procurement teams (named: Ellen Li, PM at Ramp).
- **Manual pain (before):** Finance staff manually collect **5M+ receipts/month** from email, Slack, and merchant portals; procurement approvers hand-gather vendor security certs, compliance docs, and pricing across many sites.
- **Agent flow:** *Receipt agent* — log into merchant order-history portals, pull receipt data, sync to the matching Ramp transaction. *Procurement agent* — open each vendor site, extract compliance posture/certifications/contract terms/pricing, compile a decision package for a **human approver**.
- **Inputs / Outputs / Artifacts:** *Out:* receipts attached to transactions; complete approver-ready procurement package.
- **Why end-to-end:** **~30,000 hrs/month** reclaimed from receipt automation; **4,200 hrs/month** saved across finance agents for Ramp's customers. Recurring, multi-step, produces a real artifact.
- **Source:** Browserbase — `browserbase.com/blog/case-study-ramp` (verified high; figures vendor-reported).

## 5. Pharmacy invoice retrieval from PBM / wholesaler portals  ★★★★

- **Persona:** Pharmacy back-office / AP team.
- **Manual pain (before):** Staff log into **6+ portals** — McKesson Connect, Cardinal Health, AmerisourceBergen (wholesalers) + Express Scripts, CVS Caremark, OptumRx (PBMs) — each with separate creds, MFA/TOTP, rotating security questions, session timeouts. **~10+ hrs/month**; ~$15/invoice, 14.6-day cycle.
- **Agent flow:** One workflow logs into each portal **in parallel** → handle MFA/TOTP + CAPTCHA → navigate to billing/invoices → filter by date range → download invoice PDFs → extract structured invoice JSON (number, date, total, vendor, line items) → drop to cloud storage.
- **Inputs / Outputs / Artifacts:** *Out:* aggregated invoice PDFs + JSON. *Artifact:* audit trail w/ screenshots + video replay; self-heals on UI change.
- **Why end-to-end:** Recurring monthly multi-portal retrieval no human wants; minutes vs hours. (Related Skyvern AP guide: per-invoice cost **$6.20 → $1.45**, with SAP/NetSuite/Workday landing.)
- **Source:** Skyvern — `skyvern.com/blog/automating-pharmacy-invoice-downloads-from-pbm-and-wholesaler-portals-march-2026/` (verified high).

## 6. Multi-state sales-tax compliance filing  ★★★★  *(read the caveat)*

- **Persona:** E-commerce sellers + accountants with multi-state tax obligations.
- **Manual pain (before):** Manually log into **48+ unique state tax portals**, each with different login + 2FA, track varying deadlines, file returns by hand (or pay an accountant / risk non-compliance).
- **Agent flow:** Built on **Browserbase + Stagehand** (natural-language prompts, not DOM selectors) → verify client credentials across state portals → navigate diverse 2FA → add Numeral as authorized user → submit filings per portal; self-heals when portals change.
- **⚠️ Verification caveats (2 claims refuted):** The "48" figure is confirmed for **credential verification across 48 portals**; *active filing* across all 48 is described as rolling out ("started… expanding rapidly"), not fully live. The **"~5 minutes a month"** figure is a **Numeral marketing tagline** (their Shopify listing title), not an independently measured outcome. Use as "minimal monthly effort," don't quote the number as fact.
- **Why end-to-end:** Monthly recurring cadence; "days of brittle Playwright scripting per portal" eliminated.
- **Source:** Browserbase — `browserbase.com/blog/numeral-automates-sales-tax`.

## 7. Hospital nurse-license verification  ★★★★

- **Persona:** Hospital HR / compliance.
- **Manual pain (before):** Per-shift manual credential checks against state nursing boards.
- **Agent flow:** **Nightly scheduled job** (e.g., 2 AM) spins up **50 parallel sessions** → log into 50+ state nursing-board portals → open the **License Lookup** table → enter each nurse's license number → scrape status + expiration (handle CAPTCHA/geo via stealth) → if DOM changed, LLM reroutes selectors → write to HRIS → attach session replay → **email alerts for licenses expiring within 30 days**.
- **Inputs / Outputs / Artifacts:** *In:* nurse roster. *Out:* status written to HRIS + expiry alert emails. *Artifact:* session replay per check.
- **Why end-to-end:** Scheduled, self-healing, alerting — a "set it and forget it" compliance sweep.
- **Source:** Browserbase — `browserbase.com/blog/what-can-i-use-browserbase-for` (verified; vendor-named workflow).

## 8. Hospital insurance claims reconciliation  ★★★★

- **Persona:** Healthcare revenue-cycle team (Commure "Scout").
- **Manual pain (before):** Manually chase claim status across insurer payer portals.
- **Agent flow:** Log into payer portals → monitor claim updates → download claim PDFs / EOBs → reconcile payments against hospital records → flag discrepancies → log session replays for **HIPAA audit**.
- **Why end-to-end:** **20x jump in daily claims processed; 8,000+ manual hours saved in 3 months** (vendor). The HIPAA replay artifact is the enterprise-trust hook.
- **Source:** Browserbase — `browserbase.com/blog/case-study-commure` + `what-can-i-use-browserbase-for` (verified high; corroborated by named exec quote).

## 9. Bank / fintech KYC onboarding due diligence  ★★★

- **Persona:** Bank/fintech onboarding analysts (Parcha).
- **Manual pain (before):** Analysts spend **~1 hr per business** collecting website content, corporate filings, and sanction-list hits, then scoring risk.
- **Agent flow:** Open required websites, corporate-filing sources, and sanction/watchlists **in parallel** → extract → score risk signals → compile a compliance assessment for review.
- **Why end-to-end:** **~1 hr → ~10 sec/prospect** (vendor). Multi-source aggregation + scoring, not a lookup.
- **Source:** Browserbase — `browserbase.com/blog/what-can-i-use-browserbase-for` (verified high).

## 10. High-volume job applications  ★★★  *(ToS caveat)*

- **Persona:** Job seekers; recruiters submitting across niche boards; a founder running an application SaaS.
- **Manual pain (before):** Re-filling the same profile/resume into hundreds of different ATS forms by hand (~30 min each to tailor).
- **Agent flow:** Upload resume → paste a list of job links → agent navigates each posting → fills dynamic fields + uploads resume + **AI-tailors answers** to complex questions → submits → routes employer replies back to inbox. Runs **hundreds concurrently** (one founder: 1,000+ apps/day).
- **⚠️ Caveat:** Real-LinkedIn/board automation carries **ToS risk** — stage on a sandbox/demo account, not a live LinkedIn login.
- **Source:** Skyvern Jobs Agent — `skyvern.com/blog/launching-skyverns-jobs-agent-automate-job-applications-with-ai-2/` (verified high).

---

## Honorable mentions (good for breadth, lighter sourcing)

- **Title-company county-record retrieval** (Skyvern): pull ~200 county records/month, **150–300 hrs** today because every county portal differs (email vs SMS 2FA, mid-search session expiry). Great "long-tail legacy portal" demo. — `skyvern.com/blog/api-less-system-automation-tools-legacy-enterprise/`
- **Vendor security-questionnaire filling** (Skyvern, same source): enterprise sales stalls when buyers send security questionnaires via different trust portals; agent fills/submits across them.
- **Delaware C-corp franchise-tax filing** (Skyvern, Show HN `news.ycombinator.com/item?id=39706004`): the exact "boring filing" example Browserbase's founder also cites in his talks — strong narrative overlap.
- **Cross-site research → CRM** (Manus Browser Operator, `manus.im/blog/manus-browser-operator`): research 5 companies, pull from Crunchbase/PitchBook/SimilarWeb/Ahrefs, find LinkedIn contacts, write to CRM — runs in a *visible* tab. Feature announcement, so script the flow yourself.
- **Government-portal permitting/licensing** (Anchor Browser, WorkBeaver): permits, license renewals, regulatory filings on legacy ASP.NET portals.
- **⚠️ Adjacent, NOT a browser agent — OpenAI ChatGPT "workspace agents" sales meeting-prep:** excellent recurring sales-prep story (Calendar → SharePoint → web news → 2–3 pg brief → email), verified verbatim against OpenAI's cookbook. But it runs on **app connectors / Codex cloud, not DOM-level browser automation** — include only as a "where the category is going" slide, clearly labeled, or it'll mislead a technical buyer. — `developers.openai.com/cookbook/articles/chatgpt-agents-sales-meeting-prep`

---

## Cross-cutting demo-design notes (what makes these *show* well)

1. **Parallel fan-out is the hero shot.** "Submit one profile → watch 20 browsers open at once → quotes come back" (insurance, sales research, KYC) is the single most compelling visual. demoless's room can stage this directly.
2. **The artifact closes the deal.** Audit trail with screenshots (prior auth, claims), renamed PDFs landed in the AMS (insurance), a decision-maker brief (sales) — show the *output*, not just the browsing.
3. **Auth friction is the proof of "real."** Every credible workflow leans on handling **login + 2FA/TOTP + CAPTCHA + session timeouts**. Demoing the agent clearing a CAPTCHA/2FA is what separates this from a scraper.
4. **Self-healing = the objection-killer.** "Hartford moved a button" / "portal redesigned" → vision+LLM adapts where selector-based RPA breaks. Stage a before/after where a layout change doesn't break the run.
5. **Recurring cadence beats one-shot.** Scheduled nightly/monthly runs (nurse licenses, tax filing, invoices) are what make these *workflows* not *lookups* — emphasize the trigger/schedule.

## Caveats for the exec audience

- **Numbers are vendor-reported.** Time-savings and ROI figures come from case studies / use-case pages, not third-party audits. Two Numeral claims were actively refuted (see #6). Present as "vendor-reported," not measured.
- **ToS / compliance risk** on LinkedIn and live logins (#3, #10) — stage on sandbox accounts; Browserbase's own guidance is "be a good citizen, respect robots.txt, you'll get blocked if abusive."
- **Browserbase-native vs ecosystem.** Directly usable as "a Browserbase customer did this": #3 Aomni, #4 Ramp, #6 Numeral, #7 nurse-license, #8 Commure, #9 Parcha. Skyvern-built (#1, #2, #5, #10) prove the *category* and map onto Browserbase's own insurance/healthcare use-case pages — frame as "this kind of workflow," not "a Browserbase customer."

## Source index

Browserbase: `/blog/case-study-aomni`, `/blog/case-study-ramp`, `/blog/case-study-commure`, `/blog/numeral-automates-sales-tax`, `/blog/what-can-i-use-browserbase-for`, `/use-case/browser-automation-for-insurance` · Skyvern: `/blog/automate-insurance-carrier-portal-workflows/`, `/blog/automate-healthcare-prior-authorization-insurance-portals/`, `/blog/automating-pharmacy-invoice-downloads-...-march-2026/`, `/blog/how-to-automate-downloading-invoices-september-2025/`, `/blog/launching-skyverns-jobs-agent-...`, `/blog/api-less-system-automation-tools-legacy-enterprise/`, Show HN `news.ycombinator.com/item?id=39706004` · Optexity `/blog/automating-prior-authorization-...` · VentureBeat Aomni coverage · Manus `/blog/manus-browser-operator` · Simular `/workflow/how-to-automate-linkedin-job-hunts-...` · FillApp `/blog/fillapp-ai-form-filling-for-insurance-agents` · Anchor Browser `/browser-automation-for-government-portals` · OpenAI workspace agents announcement + cookbook (adjacent/connector-based).
