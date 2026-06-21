// Redis key builder for the cross-session demo-learnings stream. Keyed per
// company (the product being demoed), global across all buyers/sessions.
// Namespaced under `demoless:` to share a Redis instance with other tracks.

export const NS = "demoless";

/** Stable, filesystem-safe slug for a company/product name. */
export function companySlug(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stream holding the append-only cross-session learnings for one company. */
export function learningsKey(company: string): string {
  return `${NS}:learnings:${companySlug(company)}`;
}
