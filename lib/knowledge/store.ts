import { getRedis } from "../memory/redis";
import { KB_INDEX, KB_PREFIX, companySlug, chunkKey } from "./keys";
import { embed, toFloat32Buffer, EMBED_DIM } from "./embed";
import { chunkText } from "./chunk";
import type { KnowledgeDoc, SearchHit } from "./types";

let indexReady = false;

/**
 * Create the RediSearch vector index once (idempotent). Requires Redis Stack —
 * if FT.* isn't available, throws a clear hint to start `redis/redis-stack`.
 */
export async function ensureIndex(): Promise<void> {
  if (indexReady) return;
  const redis = getRedis();
  try {
    // VECTOR HNSW takes 6 attribute values (3 pairs): TYPE/DIM/DISTANCE_METRIC.
    await redis.call(
      "FT.CREATE",
      KB_INDEX,
      "ON",
      "HASH",
      "PREFIX",
      "1",
      KB_PREFIX,
      "SCHEMA",
      "company",
      "TAG",
      "title",
      "TEXT",
      "source",
      "TEXT",
      "text",
      "TEXT",
      "vector",
      "VECTOR",
      "HNSW",
      "6",
      "TYPE",
      "FLOAT32",
      "DIM",
      String(EMBED_DIM),
      "DISTANCE_METRIC",
      "COSINE"
    );
    indexReady = true;
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/index already exists/i.test(msg)) {
      indexReady = true;
      return;
    }
    if (/unknown command/i.test(msg)) {
      throw new Error(
        "Vector search requires Redis Stack (RediSearch). Start it with: " +
          "docker run -p 6379:6379 redis/redis-stack:latest"
      );
    }
    throw err;
  }
}

/**
 * Chunk + embed + store a company's documents (P-knowledge ingest). Returns the
 * number of chunks indexed. The vector is stored as a FLOAT32 blob on each hash.
 */
export async function indexDocuments(
  company: string,
  docs: KnowledgeDoc[]
): Promise<number> {
  await ensureIndex();
  const redis = getRedis();
  const slug = companySlug(company);

  const items: { id: string; title?: string; source?: string; text: string }[] =
    [];
  docs.forEach((doc, di) => {
    const base = doc.id ?? `d${di}`;
    chunkText(doc.text).forEach((text, ci) => {
      items.push({
        id: `${base}-${ci}`,
        title: doc.title,
        source: doc.source,
        text,
      });
    });
  });
  if (items.length === 0) return 0;

  const vectors = await embed(items.map((i) => i.text));

  const pipeline = redis.pipeline();
  items.forEach((it, i) => {
    const fields: (string | Buffer)[] = [
      "company",
      slug,
      "title",
      it.title ?? "",
      "source",
      it.source ?? "",
      "text",
      it.text,
      "vector",
      toFloat32Buffer(vectors[i]),
    ];
    pipeline.hset(chunkKey(company, it.id), ...fields);
  });
  await pipeline.exec();
  return items.length;
}

function parseSearchReply(reply: unknown[]): SearchHit[] {
  const hits: SearchHit[] = [];
  if (!Array.isArray(reply) || reply.length < 2) return hits;

  // RESP2 FT.SEARCH: [ total, key, [f, v, f, v, ...], key, [...], ... ]
  for (let i = 1; i < reply.length; i += 2) {
    const key = String(reply[i]);
    const flat = reply[i + 1];
    if (!Array.isArray(flat)) continue;

    const f: Record<string, string> = {};
    for (let j = 0; j < flat.length; j += 2) {
      f[String(flat[j])] = String(flat[j + 1]);
    }

    const distance = Number(f.score ?? "1");
    const id = key.startsWith(KB_PREFIX) ? key.slice(KB_PREFIX.length) : key;
    hits.push({
      id,
      company: id.split(":")[0] ?? "",
      title: f.title || undefined,
      source: f.source || undefined,
      text: f.text ?? "",
      score: 1 - distance, // cosine distance -> similarity
    });
  }
  return hits;
}

/**
 * Semantic search over a company's knowledge (the core RAG step). Embeds the
 * query, runs a KNN search pre-filtered to the company, and returns the top `k`
 * hits ordered by similarity.
 */
export async function searchKnowledge(
  company: string,
  query: string,
  k = 4
): Promise<SearchHit[]> {
  await ensureIndex();
  const redis = getRedis();
  // Escape the tag separator so a dashed slug matches literally.
  const tag = companySlug(company).replace(/-/g, "\\-");

  const [vec] = await embed([query]);
  const blob = toFloat32Buffer(vec);

  const reply = (await redis.call(
    "FT.SEARCH",
    KB_INDEX,
    `(@company:{${tag}})=>[KNN ${k} @vector $BLOB AS score]`,
    "PARAMS",
    "2",
    "BLOB",
    blob,
    "RETURN",
    "4",
    "title",
    "source",
    "text",
    "score",
    "SORTBY",
    "score",
    "DIALECT",
    "2"
  )) as unknown[];

  return parseSearchReply(reply);
}

/** Delete a company's indexed chunks so a re-seed starts clean. */
export async function clearKnowledge(company: string): Promise<number> {
  const redis = getRedis();
  const pattern = `${KB_PREFIX}${companySlug(company)}:*`;
  let cursor = "0";
  let deleted = 0;
  do {
    const [next, keys] = (await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      200
    )) as [string, string[]];
    cursor = next;
    if (keys.length) deleted += await redis.del(...keys);
  } while (cursor !== "0");
  return deleted;
}
