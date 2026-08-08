import { describe, expect, test } from "bun:test";
import { createShortLivedRequestCache } from "./short-lived-request-cache";

describe("short-lived request cache", () => {
  test("återanvänder lyckat svar tills TTL löper ut", async () => {
    let now = 1_000;
    let calls = 0;
    const cache = createShortLivedRequestCache<number>({
      ttlMs: 500,
      maxEntries: 10,
      now: () => now,
    });
    const load = async () => ++calls;

    expect(await cache.get("same", load)).toBe(1);
    expect(await cache.get("same", load)).toBe(1);
    expect(calls).toBe(1);

    now += 501;
    expect(await cache.get("same", load)).toBe(2);
    expect(calls).toBe(2);
  });

  test("deduplicerar samtidiga identiska requests", async () => {
    let release: ((value: number) => void) | undefined;
    let calls = 0;
    const cache = createShortLivedRequestCache<number>({ ttlMs: 500, maxEntries: 10 });
    const load = () => {
      calls += 1;
      return new Promise<number>((resolve) => {
        release = resolve;
      });
    };

    const first = cache.get("same", load);
    const second = cache.get("same", load);
    expect(calls).toBe(1);
    release?.(7);

    expect(await first).toBe(7);
    expect(await second).toBe(7);
  });

  test("cachar inte misslyckade requests", async () => {
    let calls = 0;
    const cache = createShortLivedRequestCache<number>({ ttlMs: 500, maxEntries: 10 });

    await expect(
      cache.get("failure", async () => {
        calls += 1;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await cache.get("failure", async () => ++calls)).toBe(2);
  });
});
