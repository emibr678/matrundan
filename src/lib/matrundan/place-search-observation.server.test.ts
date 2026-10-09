import { expect, test } from "bun:test";
import { observePlaceSearch, observeProviderRequest } from "./place-search-observation.server";

test("concurrent search observations remain isolated and include failed calls", async () => {
  const [first, second] = await Promise.all([
    observePlaceSearch(async () => {
      await observeProviderRequest(async () => ({ features: [1, 2] }));
      await observeProviderRequest(async () => {
        throw new Error("failure");
      }).catch(() => {});
      return { count: 2 };
    }),
    observePlaceSearch(async () => {
      await observeProviderRequest(async () => ({ features: [1] }));
      return { count: 1 };
    }),
  ]);
  expect(first.observation).toMatchObject({ requests: 2, failures: 1, providerFeatures: 2 });
  expect(second.observation).toMatchObject({ requests: 1, failures: 0, providerFeatures: 1 });
  expect(Object.keys(first.observation).sort()).toEqual([
    "elapsedMs",
    "failures",
    "providerFeatures",
    "providerMs",
    "requests",
  ]);
});
