/**
 * Placeholder product-facts blob (P1D owns the real one).
 *
 * P2B ("one real answer end-to-end") needs *some* grounded knowledge for the
 * stub orchestrator to answer from. This is deliberately small and swappable:
 * when P1D lands a scraped KB / Redis-backed facts layer, replace
 * {@link getProductFacts} with their loader and the rest of P2 is unchanged.
 */

export interface ProductFacts {
  /** Product being demoed. */
  product: string;
  /** Raw markdown/text facts the agent can ground answers in. */
  blob: string;
}

const DEMOLESS_FACTS = `# Demoless - product facts

## What it is
Demoless is an AI agent platform for live product demos. It sits on a company's
website or in outbound campaigns and demos their product for them, 24/7. It runs
real voice conversations with prospects, answers product questions, handles
objections, qualifies leads, and books meetings.

## How it learns
It learns from sales decks, product docs, past sales transcripts, live
walkthroughs, and internal wikis. Every conversation makes it smarter: it learns
new objection patterns, adapts to different buyer personas, and builds deeper
product understanding over time.

## Outcome for sales teams
Sales teams wake up to warm pipeline with full conversation context instead of
cold form fills. Human reps only join the calls that are actually ready.

## Pricing
- Starter: $0/mo, up to 50 demos per month.
- Growth: $1,200/mo, unlimited demos plus CRM sync. Most popular.
- Enterprise: custom pricing with SSO, SLA, and data residency.

## Integrations
One-click or native sync with Salesforce, HubSpot, Slack, Segment, Zapier
(5,000+ apps), and Gmail. Leads and call data sync the moment a demo ends.

## Security
SOC 2 Type II (audited annually), SSO/SAML (Okta, Azure AD), GDPR with DPA on
request, encryption at rest and in transit, US/EU data residency, and quarterly
third-party penetration testing.

## Typical ROI
For a mid-sized outbound team running ~48 demos/week, Demoless reclaims about
12.4 rep-hours per week and adds roughly $418K in pipeline per quarter.
`;

const FACTS: ProductFacts = {
  product: "Demoless",
  blob: DEMOLESS_FACTS,
};

export function getProductFacts(): ProductFacts {
  return FACTS;
}
