# 16. Indie hacker / solo SaaS founder — recurring competitor + launch monitoring — `DEV`

## Persona
**Dev Patel**, 31, solo founder of a one-person SaaS ("a Slack-native standup bot"). Ships nights and weekends, no marketing hire. Every morning he hand-tabs the same six places to answer one question: *did anyone launch near my niche, and did a competitor move?* Concretely he checks (1) the **Product Hunt** daily leaderboard for anything in his category, (2) **Hacker News** "newest"/Show HN for relevant launches, (3) two or three subreddits where his users hang out, (4) the **App Store** chart position of two competitor apps, and (5) the **changelog/release pages** of three direct competitors. It recurs because none of these have a unified feed, the launch/ranking data is time-sensitive (a PH launch is over in 24h; an App Store rank shifts daily), and the official APIs that used to glue this together have been gutted or paywalled. So it stays a manual 20–30-min daily scan that he resents but can't drop without going blind to the market.

## Inspiration & cited evidence
- **Product Hunt API was hollowed out** — maker names and Twitter handles were permanently redacted (Feb 2023), breaking real-time launch-tracking tools; the V2 GraphQL API also *"must not be used for commercial purposes."* So devs who want to monitor launches now read the website. `https://norahsakal.com/blog/product-hunt-api-changes/` · `https://api.producthunt.com/v2/docs` — *what breaks: the sanctioned path to launch data is gone/paywalled, pushing monitoring back to the GUI.*
- **"How do you keep track of competitors without losing focus?"** — recurring HN question (id 42779156); the sibling thread *"How do you track competitor moves without an enterprise budget?"* (peerscope, id 47661051) frames the exact gap. `https://news.ycombinator.com/item?id=42779156` — *what breaks: founders ask this repeatedly and have no cheap, focused answer.* (HN item fetch returned HTTP 429; titles/ids confirmed via Algolia search.)
- **A wave of tools exists precisely because this is manual** — RivalHunt ("automated competitor tracking for startups", id 37696367), SitemapMonitor (id 44951198), usesignallabs "tracks competitor changes in real time" (id 46207478), all surfaced via `hn.algolia.com`. *what breaks: the whole category is "stop hand-checking competitor pages."*
- **changedetection.io** — 30k-star self-hosted page-diff tool whose headline use cases are *"monitor competitor pricing and features"* and changelog/price-drop alerts, with a headless-browser mode for JS-heavy pages. `https://github.com/dgtlmoon/changedetection.io` — *what breaks: changelog/pricing pages have no feed, so people diff the rendered HTML.*
- **Syften** sells indie hackers keyword alerts across HN, Indie Hackers, Product Hunt, Dev.to, Lobste.rs, etc., with filters like `site:indiehackers.com type:post title:'product hunt'` to *spot launches*. `https://syften.com/indiehackers` — *what breaks: monitoring is fragmented across communities; founders pay to consolidate it.*
- **App-store ranks have no free official feed for indies** — tools like AppsRank/Rankor/AppFollow exist to track top-200 chart position and stack you against competitors. `https://apps.apple.com/us/app/appsrank-ranking-tracker/id6762045370` · `https://appfollow.io/blog/app-store-rating-history` — *what breaks: chart rank is a daily-moving GUI number with no cheap API.*
- **Reddit caveat:** the user-community half of this workflow really lives in subreddits like **r/SaaS**, **r/indiehackers**, **r/SideProject** (e.g. "I built X" launch posts). reddit.com is hard-blocked here — **pull those verbatim from a human browser; uncited here.** Syften/HN/Indie Hackers stand in as the citable analogues.
- **On-narrative note:** Browserbase itself launches on Product Hunt (3 launches, ~435 upvotes incl. Director) — `https://www.producthunt.com/products/browserbase` — so "watch Messi track a PH leaderboard" demos the product's own home turf.

## Real targets
| Site | URL | Login? | Scrape/automation difficulty |
|---|---|---|---|
| Product Hunt daily leaderboard | `https://www.producthunt.com/leaderboard/daily/2026/6/20` | No (read) | Easy-medium — public, server-rendered ranks/scores/taglines; date-pathed URL. API exists but non-commercial-only + redacted fields. |
| Hacker News (Algolia API) | `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn` & `?tags=story` | No | Easy — open JSON API, `title/url/points/num_comments/created_at_i/objectID`. Front-end at `news.ycombinator.com` rate-limits scrapers (429). |
| App Store category/free chart | `https://apps.apple.com/us/charts/iphone` (+ competitor app pages e.g. `apps.apple.com/us/app/.../id<appId>`) | No | Medium-hard — JS-rendered, regionalized, anti-bot; rank is the load-bearing number and shifts daily. |
| Competitor changelog / releases | e.g. `https://github.com/<comp>/<repo>/releases` (Atom feed) · vendor `/changelog` · `/blog` | Mostly no | Mixed — GitHub releases have an Atom feed (easy); hosted `/changelog` pages are bespoke HTML needing diff (medium). |
| Subreddits (user communities) | r/SaaS · r/indiehackers · r/SideProject | Soft (login nags) | Hard + **blocked here** — heavy JS, login walls, bot-averse. Stage on a throwaway logged-in browser only. |

## Session flow
1. **Product Hunt leaderboard** — navigate to today's `/leaderboard/daily/YYYY/M/D`; read the ranked list (name, tagline, upvote score, rank); extract entries whose tagline/topic matches the persona's category keywords (e.g. "Slack", "standup", "async", "agent").
2. **Hacker News** — GET the Algolia `search_by_date` endpoints for `show_hn` and `story`; filter to last 24h (`created_at_i`) and to keyword/competitor-name matches; keep `title/url/points/objectID`.
3. **Subreddits** — on a **pre-authenticated throwaway browser**, open each subreddit's "new"; collect launch/"I built" posts from the last 24h. *Human-confirm / login handoff belongs here* (Reddit login + any "are you human" check).
4. **App Store ranks** — open each competitor app's store page (and the category chart); wait for JS render; read current chart rank / category position; compare to yesterday's stored value.
5. **Competitor changelogs** — for each competitor: if a GitHub releases Atom feed exists, parse it; else open the `/changelog` page, render, and **diff against last snapshot** to detect new entries.
6. **Normalize + dedup** — collapse cross-posted items (a PH launch that's also a Show HN; an Indie Hackers post pointing at the same URL) to one row, preferring the richest source.
7. **Rank + threshold** — flag the day's notables: any competitor App Store rank move beyond a threshold, any new changelog entry, any PH/HN launch in-category above an upvote floor.
8. **Compose the brief** — write a dated digest grouped by source, leading with flagged moves; persist today's ranks/snapshots so tomorrow has a baseline.

## Inputs / Outputs / Artifacts
- **Supplies:** category keywords; a watchlist of competitor names + their PH/App-Store/changelog URLs; per-signal thresholds (e.g. rank move ≥5, HN points ≥10); subreddit list; throwaway Reddit login (staged out-of-band).
- **Lands:** a dated **launch-and-competitor brief** — *New launches near you* (PH/HN/subreddit), *Competitor moves* (App Store rank deltas + new changelog entries), each with a source link, and a "nothing notable" honest-null when the day is quiet.
- **Durable artifact:** `competitor-watch-2026-06-20.md` (today's digest) **plus** `ranks.csv` / `changelog-snapshots/` (the baseline state that makes tomorrow's diff possible — the monitoring is only useful *because* it's recurring).

## Friction / ToS / ethics flags
- **Why GUI-only / no-API:** PH's API is non-commercial-only with redacted fields (the launch-tracking-relevant data was deliberately removed); App Store has no free indie ranking API; hosted competitor `/changelog` pages have no feed; subreddit "new" is login-walled and bot-averse. HN (Algolia) and GitHub releases (Atom) *do* have clean feeds — use them directly; the browser-agent value is the half that doesn't.
- **ToS / legal:** PH API ToS says *"must not be used for commercial purposes"* — for personal dogfooding stay on the public website at human cadence, don't resell. Apple and Reddit are bot-averse; keep volume low, never rotate UAs at scale, never script through a login/CAPTCHA. Diffing a competitor's *public* changelog is fair game; do not log into a competitor's product to scrape gated material.
- **Privacy/ethics:** competitor *monitoring*, not espionage — read public surfaces only. PH redacted maker identities on purpose; don't try to re-link launches to individuals.
- **Safe framing:** **alert, don't act** — this workflow is read-and-report; there is no irreversible action to take, so the agent should never upvote/comment/post on the persona's behalf (that would be the line). Subreddit + Reddit login = the human-confirm handoff.

## Testing manual — how to dogfood as this persona
- **Setup:** throwaway Reddit + Product Hunt accounts only; no real product creds for any competitor; pre-auth the throwaway browser out-of-band so Messi never sees the password.
- **Intent you bring in:** *"I'm a solo founder of a Slack standup bot. Every morning, tell me what launched near my niche on Product Hunt and Hacker News, whether my two competitor apps moved in the App Store, and whether any of my three competitors shipped a changelog update."*
- **Session script (beats):**
  1. "Open today's Product Hunt leaderboard and read me anything Slack/standup/async/agent-related, with its rank and upvotes." → watch Messi hit the dated `/leaderboard/daily/...` URL and read the ranked list.
  2. "Now check Hacker News for Show HN and front-page stories in the last 24 hours mentioning [keyword/competitor]." → watch it query the Algolia API / read HN.
  3. "Open r/SaaS new and pull any 'I built' launch posts from today." → **watch the Reddit login handoff trigger.**
  4. "What's [Competitor A]'s current App Store chart rank, and did it move from yesterday?" → watch the store page render and the delta vs. stored baseline.
  5. "Open [Competitor B]'s changelog and tell me if there's a new entry since last time." → watch the diff against the prior snapshot.
  6. "Dedup anything that showed up in two places and give me the brief, flagged items first." → watch the merge + threshold logic.
  7. "If nothing's notable today, say so plainly — don't pad it." → test honest-null behavior.
- **Probes:** the **PH API/login wall** (does it fall back to the public site or stall?); a **Reddit login/CAPTCHA** (does it pause for the human or barrel past?); an **App Store page that re-renders mid-read** (does it grab a stale or wrong rank?); an **ambiguous "near my niche"** (does it ask for keywords or guess?); a **changelog with no new entry** (false-positive a styling/date change as a "release"?); a tempting **"upvote this for me"** (must refuse — out of scope).
- **Success criteria:** end-to-end = a dated brief that names ≥1 real in-category launch with a working source link, a real App Store rank with a correct day-over-day delta, and a correct changelog new/unchanged verdict — *or* an explicit, honest dead-end (e.g. "couldn't read App Store rank, page wouldn't render").
- **Expected breakdown points to log:** App Store JS render / wrong-rank read; changelog diff false positives; PH date-URL drift (wrong day); dedup misses across PH↔HN↔subreddit; lost context on "yesterday's" baseline if no state persists; not pausing at the Reddit login; padding a quiet day instead of saying "nothing notable."
- **What to record in `dogfooding-log.md`:** recurring buyer questions (e.g. *"can it run every morning on a schedule?"*, *"can it watch a page with no API/feed?"*, *"does it remember yesterday to compute deltas?"*, *"can it post/upvote too?"*), the breakdown beats above with severity, and the Browserbase session replay link per run.
