import { AsyncLocalStorage } from "node:async_hooks";

interface SearchBudgetState {
  requestLimit: number;
  creditLimit: number;
  deadline: number;
  requests: number;
  reservedCredits: number;
  limited: boolean;
  active: number;
  waiters: Array<() => void>;
}

const currentBudget = new AsyncLocalStorage<SearchBudgetState>();

/** Conservative reservations, not a provider billing report. */
export function estimatedGeoapifyCredits(url: URL): number {
  if (url.pathname === "/v2/places") {
    return Number(url.searchParams.get("limit") ?? "20") > 20 ? 4 : 1;
  }
  if (url.pathname.includes("/boundaries/")) return 4;
  if (url.pathname.includes("/place-details")) {
    return url.searchParams.get("features")?.includes("full_geometry") ? 4 : 2;
  }
  return 1;
}

export async function withPlaceSearchBudget<T extends object>(
  limits: { requests: number; credits: number; timeoutMs?: number },
  run: () => Promise<T>,
): Promise<T & { budgetUsage: { requests: number; reservedCredits: number; limited: boolean } }> {
  const state: SearchBudgetState = {
    requestLimit: Math.max(0, Math.min(25, limits.requests)),
    creditLimit: Math.max(0, Math.min(40, limits.credits)),
    deadline: Date.now() + (limits.timeoutMs ?? 10_000),
    requests: 0,
    reservedCredits: 0,
    limited: false,
    active: 0,
    waiters: [],
  };
  const result = await currentBudget.run(state, run);
  return {
    ...result,
    budgetUsage: {
      requests: state.requests,
      reservedCredits: state.reservedCredits,
      limited: state.limited,
    },
  };
}

/** Reserve atomically before each cache-miss fetch. Failed/aborted calls still count. */
export async function budgetProviderRequest<T>(estimatedCredits: number, run: () => Promise<T>) {
  const state = currentBudget.getStore();
  if (!state) return run();
  while (state.active >= 2) {
    await new Promise<void>((resolve) => state.waiters.push(resolve));
  }
  if (
    Date.now() >= state.deadline ||
    state.requests >= state.requestLimit ||
    state.reservedCredits + estimatedCredits > state.creditLimit
  ) {
    state.limited = true;
    throw new Error("GEOAPIFY_SEARCH_BUDGET: Sökningens anropsbudget har nåtts.");
  }

  state.active += 1;
  state.requests += 1;
  state.reservedCredits += estimatedCredits;
  try {
    return await run();
  } finally {
    state.active -= 1;
    state.waiters.shift()?.();
  }
}
