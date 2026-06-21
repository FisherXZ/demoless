/**
 * Dependency-free, paragraph-aware text chunker. Packs paragraphs up to
 * `maxChars`, carries a small `overlap` tail into the next chunk so a passage
 * split across a boundary still retrieves, and hard-splits any single paragraph
 * that exceeds `maxChars`.
 */

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 800;
  const overlap = opts.overlap ?? 150;

  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paras = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const packed: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > maxChars) {
      packed.push(cur);
      const tail = overlap > 0 ? cur.slice(-overlap) : "";
      cur = tail ? `${tail}\n\n${p}` : p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) packed.push(cur);

  // Hard-split anything still over the limit (e.g. one giant paragraph).
  const out: string[] = [];
  const step = Math.max(1, maxChars - overlap);
  for (const c of packed) {
    if (c.length <= maxChars) {
      out.push(c);
      continue;
    }
    for (let i = 0; i < c.length; i += step) {
      out.push(c.slice(i, i + maxChars));
    }
  }
  return out;
}
