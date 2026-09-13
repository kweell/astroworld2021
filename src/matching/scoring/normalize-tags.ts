/** Lower-cases and trims a tag for canonical comparison. */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag))];
}

/** Normalized intersection of two tag lists (order follows `a`). */
export function tagOverlap(a: string[], b: string[]): string[] {
  const normalizedB = new Set(normalizeTags(b));
  const seen = new Set<string>();
  const overlap: string[] = [];

  for (const tag of a) {
    const normalized = normalizeTag(tag);
    if (normalizedB.has(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      overlap.push(normalized);
    }
  }

  return overlap;
}

/** Fraction of `a` (normalized, deduped) also present in `b`. 0 when `a` is empty. */
export function overlapRatio(a: string[], b: string[]): number {
  const normalizedA = normalizeTags(a);
  if (normalizedA.length === 0) return 0;
  return tagOverlap(normalizedA, b).length / normalizedA.length;
}
