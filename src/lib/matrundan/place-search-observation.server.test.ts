import { expect, test } from "bun:test";
import {
  observePlaceSearch,
  observeProviderRequest,
  recordSearchCandidateCounts,
  recordSearchCandidateFlow,
  recordSearchPhaseMs,
} from "./place-search-observation.server";

test("concurrent search observations remain isolated and include failed calls", async () => {
  const [first, second] = await Promise.all([
    observePlaceSearch(async () => {
      recordSearchPhaseMs("sources", 12);
      recordSearchCandidateCounts({ primary: 2, canonical: 0, nearby: 0, typo: 0 });
      recordSearchCandidateFlow({ rawPlaces: 5, acceptedPlaces: 2, rejectedByIntent: 3 });
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
  expect(first.observation.candidates.primary).toBe(2);
  expect(second.observation.candidates.primary).toBe(0);
  expect(first.observation.candidateFlow).toMatchObject({
    rawPlaces: 5,
    acceptedPlaces: 2,
    rejectedByIntent: 3,
    rejectedByNearbyName: 0,
  });
  expect(second.observation.candidateFlow.rawPlaces).toBe(0);
  expect(first.observation.providerCalls.other).toBe(2);
  expect(second.observation.providerCalls.other).toBe(1);
  expect(Object.keys(first.observation).sort()).toEqual([
    "candidateFlow",
    "candidates",
    "elapsedMs",
    "failures",
    "phaseMs",
    "providerCalls",
    "providerFeatures",
    "providerMs",
    "requests",
  ]);
});
