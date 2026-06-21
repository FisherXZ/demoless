/**
 * Redis key + index names for the product-knowledge RAG layer.
 *
 * Lives under the shared `demoless:` namespace, separate from the P4 buyer
 * memory (`demoless:buyer:*`). This is the "what does the product do" corpus,
 * not the "who is this buyer" notes — keyed by company, searched by vector.
 */

export const KB_NS = "demoless:kb";

/** Single RediSearch index across all companies (filtered by the `company` tag). */
export const KB_INDEX = "demoless:kb-idx";

/** Key prefix the index scans; every chunk hash lives under it. */
export const KB_PREFIX = "demoless:kb:";

/** Stable per-company key/tag segment: lowercase, alnum + dashes. */
export function companySlug(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Hash holding one embedded chunk: `demoless:kb:{company}:{chunkId}`. */
export function chunkKey(company: string, id: string): string {
  return `${KB_PREFIX}${companySlug(company)}:${id}`;
}

/** Key prefix for the source-of-record hashes (curated prose, not derived vectors). */
export const KB_SOURCE_PREFIX = "demoless:kb-source:";

/** Hash holding one curated source doc: `demoless:kb-source:{company}:{docId}`. */
export function sourceKey(company: string, id: string): string {
  return `${KB_SOURCE_PREFIX}${companySlug(company)}:${id}`;
}
