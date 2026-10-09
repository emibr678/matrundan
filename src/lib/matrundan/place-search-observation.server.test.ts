import { expect, test } from "bun:test";
import { observePlaceSearch, observeProviderRequest, recordSearchPhaseMs } from "./place-search-observation.server";

test("concurrent search observations remain isolated and include failed calls", async () => {
  const [first, second] = await Promise.all([
    observePlaceSearch(async () => {
      recordSearchPhaseMs("sources", 12);
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
  expect(first.observation.phaseMs.sources).toBe(12);
  expect(second.observation.phaseMs.sources).toBe(0);
  expect(Object.keys(first.observation).sort()).toEqual([
    "elapsedMs",
    "failures",
    "providerFeatures",
    "providerMs",
    "phaseMs",
    "requests",
  ]);
});
