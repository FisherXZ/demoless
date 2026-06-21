/**
 * Product-knowledge RAG (vector search). Public surface imported by P1's server.
 *
 * Distinct from `lib/memory` (P4 buyer notes): this answers "what does the
 * product do" via semantic search over a company's docs, keyed by company slug.
 *
 * Typical wiring (P1C):
 *   - boot:        ensureIndex()
 *   - onboarding:  indexDocuments(company, docs)         (later: upload / P3 crawl)
 *   - each Q:      buildAnswerContext(await searchKnowledge(company, question))
 *                  -> inject into the prompt alongside buildMemoryContext(memory)
 */

export { getRedis, closeRedis } from "../memory/redis";
export { KB_INDEX, KB_PREFIX, KB_SOURCE_PREFIX, companySlug, chunkKey, sourceKey } from "./keys";
export { embed, toFloat32Buffer, EMBED_MODEL, EMBED_DIM } from "./embed";
export { chunkText } from "./chunk";
export {
  ensureIndex,
  indexDocuments,
  searchKnowledge,
  clearKnowledge,
} from "./store";
export { buildAnswerContext } from "./answer";
export {
  putSourceDoc,
  getSourceDoc,
  listSourceDocs,
  deleteSourceDoc,
  reindexFromSource,
} from "./source";
export type { KnowledgeDoc, Chunk, SearchHit, SourceDoc } from "./types";
