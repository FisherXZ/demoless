/**
 * Contracts for the product-knowledge RAG layer. Kept separate from
 * `lib/memory/types.ts` (buyer memory) on purpose — different dataset, different
 * retrieval. Provisional pending P1B.1's shared message types, like P4's.
 */

/** A document to index. `text` is chunked + embedded; the rest is metadata. */
export interface KnowledgeDoc {
  id?: string;
  title?: string;
  source?: string;
  text: string;
}

/** A stored chunk (one embedded passage of a document). */
export interface Chunk {
  id: string;
  company: string;
  title?: string;
  source?: string;
  text: string;
}

/** A retrieval result. `score` is cosine similarity in [0, 1] (higher = closer). */
export interface SearchHit {
  id: string;
  company: string;
  title?: string;
  source?: string;
  text: string;
  score: number;
}
