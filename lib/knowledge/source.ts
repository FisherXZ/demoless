/**
 * Store-of-record for curated product-knowledge source docs.
 *
 * Vectors in `demoless:kb:*` are DERIVED and can be regenerated. The authoritative
 * prose lives here in `demoless:kb-source:{company}:{docId}` hashes. Agents and
 * scripts edit these hashes, then call `reindexFromSource` to rebuild vectors.
 */
import { getRedis } from "../memory/redis";
import { companySlug, sourceKey, KB_SOURCE_PREFIX } from "./keys";
import { clearKnowledge, indexDocuments } from "./store";
import type { SourceDoc, KnowledgeDoc } from "./types";

function serializeDoc(doc: SourceDoc): Record<string, string> {
  return {
    id: doc.id,
    title: doc.title,
    source: doc.source ?? "",
    group: doc.group ?? "",
    text: doc.text,
    updatedAt: doc.updatedAt,
  };
}

function deserializeDoc(fields: Record<string, string>): SourceDoc {
  return {
    id: fields.id,
    title: fields.title,
    source: fields.source || undefined,
    group: fields.group || undefined,
    text: fields.text,
    updatedAt: fields.updatedAt,
  };
}

/** Write (upsert) a source doc. Timestamps are set by the caller. */
export async function putSourceDoc(
  company: string,
  doc: SourceDoc
): Promise<void> {
  const redis = getRedis();
  const key = sourceKey(company, doc.id);
  const fields = serializeDoc(doc);
  const flat: string[] = [];
  for (const [k, v] of Object.entries(fields)) flat.push(k, v);
  await redis.hset(key, ...flat);
}

/** Read a source doc by id. Returns null if not found. */
export async function getSourceDoc(
  company: string,
  id: string
): Promise<SourceDoc | null> {
  const redis = getRedis();
  const fields = (await redis.hgetall(
    sourceKey(company, id)
  )) as Record<string, string> | null;
  if (!fields || !fields.id) return null;
  return deserializeDoc(fields);
}

/** List all source docs for a company. */
export async function listSourceDocs(company: string): Promise<SourceDoc[]> {
  const redis = getRedis();
  const pattern = `${KB_SOURCE_PREFIX}${companySlug(company)}:*`;
  let cursor = "0";
  const docs: SourceDoc[] = [];
  do {
    const [next, keys] = (await redis.scan(cursor, "MATCH", pattern, "COUNT", 200)) as [
      string,
      string[],
    ];
    cursor = next;
    for (const key of keys) {
      const fields = (await redis.hgetall(key)) as Record<string, string> | null;
      if (fields?.id) docs.push(deserializeDoc(fields));
    }
  } while (cursor !== "0");
  return docs;
}

/** Delete a source doc by id. */
export async function deleteSourceDoc(
  company: string,
  id: string
): Promise<void> {
  const redis = getRedis();
  await redis.del(sourceKey(company, id));
}

/**
 * Rebuild the vector index from the source-of-record docs.
 * Clears all existing `kb:*` chunks for the company then re-embeds.
 * Returns the number of chunks indexed.
 */
export async function reindexFromSource(company: string): Promise<number> {
  const sourceDocs = await listSourceDocs(company);
  if (sourceDocs.length === 0) {
    console.warn(`reindexFromSource: no source docs found for "${company}"`);
    return 0;
  }
  const docs: KnowledgeDoc[] = sourceDocs.map((d) => ({
    id: d.id,
    title: d.title,
    source: d.source,
    text: d.text,
  }));
  const cleared = await clearKnowledge(company);
  if (cleared) console.log(`  cleared ${cleared} existing chunk(s)`);
  return indexDocuments(company, docs);
}
