/**
 * Embeddings via OpenAI. Claude doesn't produce embeddings, so we call OpenAI's
 * /v1/embeddings directly (global fetch, no SDK dependency).
 *
 * Config (see .env.example):
 *   OPENAI_API_KEY   required
 *   EMBED_MODEL      default text-embedding-3-small
 *   EMBED_DIM        default 1536 — must match the model and the index schema
 */

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export const EMBED_MODEL = process.env.EMBED_MODEL ?? "text-embedding-3-small";
export const EMBED_DIM = Number(process.env.EMBED_DIM ?? 1536);

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

/** Embed a batch of texts. Returns one vector per input, in input order. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable — Node 18+ is required.");
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set (see .env.example).");
  }

  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as OpenAIEmbeddingResponse;
  // The API may return items out of order; sort by index to be safe.
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Pack a vector into a little-endian FLOAT32 buffer for Redis (store + KNN param). */
export function toFloat32Buffer(vec: number[]): Buffer {
  const f32 = Float32Array.from(vec);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}
