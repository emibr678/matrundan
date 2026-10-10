import { isSpecificPlaceName, normalizePlaceIdentity } from "./place-discovery";

/** Exactly one insertion, deletion, substitution, or adjacent swap. */
export function hasSingleNameTypo(a: string, b: string): boolean {
  if (a === b || Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) {
    return false;
  }
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (
      a.length === b.length &&
      a.slice(0, i) === b.slice(0, i) &&
      a.slice(i + 1) === b.slice(i + 1)
    )
      return true;
    if (
      a.length === b.length &&
      i + 1 < a.length &&
      a.slice(0, i) === b.slice(0, i) &&
      a[i] === b[i + 1] &&
      a[i + 1] === b[i] &&
      a.slice(i + 2) === b.slice(i + 2)
    )
      return true;
    if (
      a.length === b.length + 1 &&
      a.slice(0, i) === b.slice(0, i) &&
      a.slice(i + 1) === b.slice(i)
    )
      return true;
    if (
      b.length === a.length + 1 &&
      a.slice(0, i) === b.slice(0, i) &&
      a.slice(i) === b.slice(i + 1)
    )
      return true;
  }
  return false;
}

/** Retrieval only. No canonical identity conclusion may follow from this score. */
export function matchesTypoPlaceName(query: string, name: string): boolean {
  if (!isSpecificPlaceName(query)) return false;
  const queries = normalizePlaceIdentity(query).split(" ");
  const words = normalizePlaceIdentity(name).split(" ");
  if (!queries.length || queries.length > 5 || words.length < queries.length || words.length > 12)
    return false;
  const used = new Set<number>();
  let fuzzy = 0;
  let exactAnchor = false;
  for (const queryWord of queries) {
    let matched = words.findIndex((word, index) => !used.has(index) && word.startsWith(queryWord));
    if (matched >= 0 && queryWord.length >= 5) exactAnchor = true;
    if (matched < 0 && fuzzy === 0) {
      matched = words.findIndex(
        (word, index) =>
          !used.has(index) &&
          (queries.length === 1
            ? queryWord.length >= 6 && hasSingleNameTypo(queryWord, word)
            : queryWord.length >= 4 &&
              (hasSingleNameTypo(queryWord, word.slice(0, queryWord.length)) ||
                hasSingleNameTypo(queryWord, word.slice(0, queryWord.length + 1)))),
      );
      if (matched >= 0) fuzzy += 1;
    }
    if (matched < 0) return false;
    used.add(matched);
  }
  return fuzzy === 1 && (queries.length === 1 || exactAnchor);
}

/** Use one strong name anchor instead of a broad first-50 category browse. */
export function typoProviderSearchSeed(query: string): string | null {
  if (!isSpecificPlaceName(query)) return null;
  const tokens = normalizePlaceIdentity(query).split(" ").filter(Boolean);
  const anchor = tokens.find((token) => token.length >= 5);
  if (!anchor) return null;
  return tokens.length > 1 ? anchor : anchor.slice(0, Math.min(anchor.length - 2, 6));
}

/**
 * A second Places name probe after a failed prefix search. A single trailing
 * doubled letter is a safe candidate spelling to try (Pelikann → pelikan).
 * This is retrieval only; it does not verify or merge a place identity.
 */
export function preciseProviderRecoverySeed(query: string): string | null {
  if (!isSpecificPlaceName(query)) return null;
  const words = normalizePlaceIdentity(query).split(" ").filter(Boolean);
  if (words.length !== 1) return null;
  const word = words[0];
  return word.length >= 6 && /([a-zåäö])\1$/u.test(word) ? word.slice(0, -1) : word;
}
