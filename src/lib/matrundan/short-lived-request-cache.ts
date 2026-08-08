export interface ShortLivedRequestCacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

/**
 * Liten processlokal cache för idempotenta provideranrop.
 *
 * Den deduplicerar samtidiga identiska requests och behåller lyckade svar en
 * kort stund. Cacheträffar är en optimering, aldrig ett krav: serverless-
 * instanser kan försvinna när som helst utan att beteendet ändras.
 */
export function createShortLivedRequestCache<T>({
  ttlMs,
  maxEntries,
  now = Date.now,
}: ShortLivedRequestCacheOptions) {
  const settled = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  function prune(currentTime: number) {
    for (const [key, entry] of settled) {
      if (entry.expiresAt <= currentTime) settled.delete(key);
    }
    while (settled.size >= maxEntries) {
      const oldestKey = settled.keys().next().value as string | undefined;
      if (!oldestKey) break;
      settled.delete(oldestKey);
    }
  }

  async function get(key: string, load: () => Promise<T>): Promise<T> {
    const currentTime = now();
    const cached = settled.get(key);
    if (cached && cached.expiresAt > currentTime) {
      settled.delete(key);
      settled.set(key, cached);
      return cached.value;
    }
    if (cached) settled.delete(key);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const request = load()
      .then((value) => {
        prune(now());
        settled.set(key, { value, expiresAt: now() + ttlMs });
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  }

  return { get };
}
