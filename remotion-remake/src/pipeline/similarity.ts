// How much of a source text a rewrite keeps, measured in words (0–1).

/** Words that are compared: links, hashtags and @mentions are left out (hashtags are kept verbatim anyway). */
export function words(text: string): string[] {
  return (
    text
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[#@][\p{L}\p{N}_.]+/gu, " ")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/** Levenshtein distance over any sequence (characters of a string, or words). */
function editDistance<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Share of the source kept in the rewrite: 1 − (words changed, added or removed) / longer length.
 * Texts under 6 words are compared letter by letter, where one changed word would be too coarse.
 */
export function similarity(source: string, rewrite: string): number {
  const a = words(source);
  const b = words(rewrite);
  if (!a.length && !b.length) return 1;
  if (Math.max(a.length, b.length) < 6) {
    const x = a.join(" ");
    const y = b.join(" ");
    return 1 - editDistance(x, y) / Math.max(x.length, y.length);
  }
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}
