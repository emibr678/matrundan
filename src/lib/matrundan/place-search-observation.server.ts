import { AsyncLocalStorage } from "node:async_hooks";
import { withPlaceSearchBudget } from "./place-search-budget.server";

type Observation = {
  requests: number;
  failures: number;
  providerFeatures: number;
  providerMs: number;
  phaseMs: { access: number; sources: number; recovery: number; identity: number };
};

const observation = new AsyncLocalStorage<Observation>();

/** Aggregate counters only: never collect URLs, search terms, identities or payloads. */
export async function observePlaceSearch<T extends object>(
  run: () => Promise<T>,
  limits: { requests: number; credits: number } = { requests: 25, credits: 40 },
) {
  const counters: Observation = {
    requests: 0,
    failures: 0,
    providerFeatures: 0,
    providerMs: 0,
    phaseMs: { access: 0, sources: 0, recovery: 0, identity: 0 },
  };
  const started = performance.now();
  const result = await withPlaceSearchBudget(limits, () => observation.run(counters, run));
  return {
    ...result,
    observation: { ...counters, elapsedMs: Math.round(performance.now() - started) },
  };
}

export function observeSearchWithBudget(limits: { requests: number; credits: number }) {
  return <T extends object>(run: () => Promise<T>) => observePlaceSearch(run, limits);
}

export async function observeProviderRequest<T extends { features?: unknown[] }>(
  run: () => Promise<T>,
): Promise<T> {
  const counters = observation.getStore();
  if (!counters) return run();
  counters.requests += 1;
  const started = performance.now();
  try {
    const result = await run();
    counters.providerFeatures += result.features?.length ?? 0;
    return result;
  } catch (error) {
    counters.failures += 1;
    throw error;
  } finally {
    counters.providerMs += Math.round(performance.now() - started);
  }
}

/** Aggregate phase times only; never record search terms, URLs, identities or group data. */
export function recordSearchPhaseMs(phase: keyof Observation["phaseMs"], milliseconds: number) {
  const counters = observation.getStore();
  if (counters) counters.phaseMs[phase] += Math.round(milliseconds);
}
