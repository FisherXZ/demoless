/** True when the visitor wants to see the product/features — skip discovery. */
export function wantsProductDemo(text: string): boolean {
  const lower = text.toLowerCase().replace(/['']/g, "'").trim();
  if (!lower) return false;

  const patterns = [
    /\b(what|which)\s+features?\b/,
    /\bfeatures?\s+(do\s+you|you\s+guys|y'?all|u\s+guys)\b/,
    /\b(show\s+me|give\s+me)\s+(a\s+)?(demo|tour|walkthrough|walk\s*through|around)\b/,
    /\bshow\s+me\s+(the\s+)?(product|browserbase|what\s+it\s+does)\b/,
    /\bwhat\s+(does|do)\s+(it|browserbase|this)\s+do\b/,
    /\btop\s+(three|3|features?)\b/,
    /\bhow\s+does\s+(it|browserbase)\s+work\b/,
    /\bcan\s+(you|i)\s+see\s+(it|the\s+product|browserbase)\b/,
    /\bwhat\s+is\s+browserbase\b/,
    /\bwhat\s+(can|could)\s+(it|browserbase)\s+do\b/,
    /\btell\s+me\s+about\s+(the\s+product|browserbase|features?)\b/,
    /\bwhat\s+are\s+you\s+(guys|all)\b/,
    /\bwhat\s+do\s+you\s+(guys|all|offer|provide|have)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}
