import { AsyncLocalStorage } from "node:async_hooks";

type Observation = {
  requests: number;
  failures: number;
  providerFeatures: number;
  providerMs: number;
};

const observation = new AsyncLocalStorage<Observation>();

/** Aggregate counters only: never collect URLs, search terms, identities or payloads. */
export async function observePlaceSearch<T>(run: () => Promise<T>) {
  const counters: Observation = { requests: 0, failures: 0, providerFeatures: 0, providerMs: 0 };
  const started = performance.now();
  const result = await observation.run(counters, run);
  return {
    ...result,
    observation: { ...counters, elapsedMs: Math.round(performance.now() - started) },
  };
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
