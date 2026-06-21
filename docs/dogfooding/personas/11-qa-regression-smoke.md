# 11. QA / Test Engineer — Nightly Cross-Browser Regression Smoke Tests — <tag: `DEV`>

## Persona
**Priya Nandakumar**, sole QA engineer at a ~30-person B2B SaaS startup (a Shopify-style merchant dashboard). There is no dedicated SDET team; she owns the pre-release gate alone. Every release candidate, she manually click-throughs the four critical flows — **login, signup, add-to-cart → checkout, and product search** — across Chrome, Firefox, and Safari/WebKit before sign-off. She *has* a Playwright suite, but it flakes badly in CI (passes locally, fails on the runner), so she doesn't trust it for the gate and falls back to manual click-through the night before each ship. The pain recurs because the app ships 2–3 times a week, the front end changes constantly (so selectors rot), and "flaky in CI but green locally" is never worth the multi-hour debug — so she keeps doing it by hand instead of fixing the suite. She wants an agent that can *run the smoke flows like a real user in real browsers* and tell her plainly what broke, without her authoring/maintaining brittle selectors.

## Inspiration & cited evidence
- **Launch HN: DeploySentinel (YC S22) — "End-to-end tests that don't flake"** — https://news.ycombinator.com/item?id=32319404 — the whole thread is QA engineers describing tests that "fail sporadically in CI but pass locally," race conditions, env differences, and teams *deleting* flaky tests rather than fixing them. What breaks: the flake is unreproducible locally, so the debug cost exceeds the value and the test gets disabled.
- **"Detecting and Handling Flaky Tests in Playwright"** — https://news.ycombinator.com/item?id=36570499 — thread on retries/waits/race conditions; recurring admission that integration-level e2e tests go flaky (e.g. listeners firing twice). What breaks: nondeterministic timing means a "passing" suite still can't be trusted as a release gate.
- **Show HN: Reflect — create e2e tests via AI prompts** — https://news.ycombinator.com/item?id=36433869 — explicitly ships "a fallback to using AI to find an element when the selectors we generated are no longer valid." What breaks: DOM/selector churn is the #1 maintenance sink; the market response is *self-healing* element location.
- **Show HN: Testronaut — AI-powered mission-based browser testing** — https://news.ycombinator.com/item?id=45043822 — pitches AI that "adapt[s] tests to small UI changes." What breaks: small UI tweaks cascade into red suites and manual re-recording.
- **Playwright cross-browser testing guidance (WebKit/Safari)** — https://playwright.dev/ — Playwright drives Chromium/Firefox/WebKit, but real Safari behavior + a maintained browser farm is exactly what teams offload to a cloud (BrowserStack/LambdaTest); see https://www.browserstack.com/automate/playwright. What breaks: maintaining your own Chrome+Firefox+WebKit matrix in CI is its own ops burden.
- **Reddit caveat:** the sharpest "I deleted the flaky test instead of fixing it" confessions live on r/QualityAssurance and r/ExperiencedDevs — **reddit is hard-blocked here; pull verbatim from a human browser — uncited here.**

## Real targets
The agent drives the **team's own staging/RC build** as the system under test (not third-party prod). Browserbase is the cloud-browser substrate; the "real sites" are the SUT plus the demo reference app.

| Site | URL | Login? | Scrape/automation difficulty |
|---|---|---|---|
| Team's staging SaaS build (SUT) | https://staging.<yourapp>.example | Yes — seeded test account | Medium: app is yours, but flows span auth, forms, async cart/search; WebKit quirks bite |
| Browserbase (cloud-browser substrate / reference product demoed) | https://www.browserbase.com / https://docs.browserbase.com | API key | N/A — it's the harness; supports Playwright/Puppeteer/Selenium cloud browsers + Stagehand "self-healing actions" |
| Saucedemo (public demo storefront, safe stand-in for checkout) | https://www.saucedemo.com | Yes — public test creds (`standard_user`) | Low: purpose-built practice target, stable selectors, irreversible-action-free |
| the-internet (Heroku) auth/flaky-element practice site | https://the-internet.herokuapp.com | Mixed | Low: canonical "dynamic loading / flaky element" probes |

## Session flow
End-to-end, per target browser (Chromium, Firefox, WebKit), Messi driving a Browserbase session:
1. **Spin a cloud browser** per OS/browser in the matrix; log the session-replay URL for each (this is the artifact reviewers click).
2. **Login flow:** navigate to `/login`, type seeded test creds, submit, assert landed on dashboard (read a known post-login element, not a fixed selector — describe it: "the user's account menu in the top-right").
3. **Signup flow:** open `/signup`, fill a throwaway `+tag` email, submit, assert the confirmation/empty-dashboard state. **Human-confirm gate:** if signup sends a real verification email or triggers billing, *stop and ask the tester* — don't auto-click "Confirm & subscribe."
4. **Search flow:** type a known query in the product search box, assert results contain the expected item, assert an empty-query / no-results case renders the right empty state.
5. **Checkout flow (use Saucedemo as the safe stand-in):** add a product to cart, go to cart, proceed to checkout, fill shipping. **Human-confirm gate at "Place Order"** — payment is irreversible; Messi should *describe the order summary and pause for explicit confirm*, never submit a real purchase.
6. **Cross-browser diff:** repeat 2–5 on WebKit; flag any flow that passed on Chromium but failed on WebKit (the classic Safari-only break).
7. **Triage output:** for each failure, capture what Messi *saw* ("Place Order button never became enabled after 8s"), the step, the browser, and the replay link — not a stack trace.
8. **Verdict:** emit PASS/FAIL per flow per browser + an overall ship/no-ship recommendation.

## Inputs / Outputs / Artifacts
- **Inputs (tester supplies):** staging base URL, seeded test-account creds (throwaway), the 4 flow descriptions in plain English, the browser matrix, and a throwaway `+tag` signup email.
- **Outputs:** a per-flow × per-browser PASS/FAIL matrix; for each FAIL, a human-readable "what broke + where + which browser" line.
- **Durable artifact:** a **nightly regression report** (the matrix + ship/no-ship verdict) with one **Browserbase session-replay link per failing flow** — so Priya watches the exact failure instead of reproducing it. Replaces the night-before manual click-through.

## Friction / ToS / ethics flags
- **Why GUI-only / no-API:** the *point* is to exercise the real rendered UI across real browser engines (WebKit-only bugs, DOM/timing flake) — those are invisible to API-level tests, which is exactly the gap that makes Priya distrust her suite.
- **Test only systems you own or are authorized to test.** This persona drives the team's own staging build + purpose-built practice targets (Saucedemo, the-internet). Do **not** point it at third-party production sites or competitors — that crosses from QA into unauthorized automated access and likely violates their ToS.
- **Irreversible actions must confirm, never autosubmit:** "Place Order," "Confirm subscription," "Delete account" → Messi describes and pauses for human confirm. Default = **alert, don't auto-submit.**
- **No real PII / PHI / payment creds.** Seeded throwaway accounts and test card numbers only (e.g. Saucedemo creds, Stripe test cards if the SUT uses Stripe). Never enter a real card.
- **MFA handoff:** if login hits a TOTP/SMS step, Messi pauses and hands the OTP entry to the tester — don't attempt to bypass.
- **Honesty about "self-healing":** an agent locating elements by description can *mask* a real regression (it "finds" a moved button the user couldn't). Log when Messi had to hunt for an element — that's a finding, not a pass.

## Testing manual — how to dogfood as this persona
- **Setup:** sandbox/throwaway accounts only. Use Saucedemo (`standard_user` / `secret_sauce`) and the-internet (Heroku) as safe public stand-ins so you never touch real PHI, real bank creds, or real PII. If you point at a private staging build, seed a disposable account.
- **Intent you bring in (in character):** "I'm Priya, the only QA here and we ship tonight. Run my four critical smoke flows — login, signup, checkout, search — across Chrome and Safari and just tell me what's broken and where. I don't want to write selectors."
- **Session script (~8 beats):**
  1. "Open Saucedemo in Chrome and log in as `standard_user`." — watch the cloud browser navigate + authenticate; confirm a replay link appears.
  2. "Search the inventory for 'backpack' and tell me what you find." — watch it read results, not just click.
  3. "Add the backpack to the cart and go to checkout." — watch cart state update.
  4. "Fill in checkout shipping info and stop before placing the order." — **verify it pauses at the irreversible step and asks you to confirm.**
  5. "Now do the whole thing again in Safari/WebKit and tell me if anything differs." — watch for a WebKit-only divergence.
  6. "On the-internet Heroku, go to the 'Dynamic Loading' example and confirm the hidden element actually appears." — push the flaky-timing probe.
  7. "Try logging in with a wrong password and tell me what happens." — watch it report the error state as a *clean negative*, not a crash.
  8. "Give me a PASS/FAIL matrix and a ship/no-ship call with replay links."
- **Probes:** (a) auth wall — wrong creds + a locked-out account (`locked_out_user` on Saucedemo); (b) CAPTCHA / MFA — does it hand off or barrel through?; (c) mid-flow page change — ask it to checkout but the cart is empty; (d) ambiguous request — "test the important flow" (does it ask which?); (e) irreversible action — does "Place Order" trigger a confirm or get auto-clicked?
- **Success criteria:** "worked end-to-end" = Messi completed each flow in ≥2 browser engines, produced an accurate PASS/FAIL per flow/browser, paused at the irreversible step, and delivered a replay link Priya can click to watch the exact failure — or reached an explicit, correctly-reported dead-end (e.g. "login blocked by MFA, handed to you").
- **Expected breakdown points to log:** (1) loses track of which browser/flow it's on across the matrix (lost context); (2) declares PASS after "self-healing" to a moved element that a real user couldn't find (false green); (3) barrels past "Place Order" instead of confirming (gate failure); (4) dead air / no narration during async waits (cart/search loading); (5) can't articulate *why* a flow failed beyond "didn't work" (weak triage); (6) treats an expected negative (wrong-password error) as a crash.
- **What to record in `dogfooding-log.md`:** recurring buyer questions ("does it run in *real* Safari or just emulate?", "how does it tell a real regression from a flaky load?", "can it self-heal selectors without hiding bugs?", "does it gate irreversible actions?", "what's the per-test-run cost at CI scale?" — the DeploySentinel $/run concern), the breakdown points above with the beat/browser they occurred on, and the Browserbase session-replay link for each.
