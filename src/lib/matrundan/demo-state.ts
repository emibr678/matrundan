import type { AppState } from "./types";

export const EXAMPLE_STATE_STORAGE_KEY = "matrundan.exampleState.v4";
export const SANDBOX_STATE_STORAGE_KEY = "matrundan.state.v1";
export const DEMO_STATE_CHANGED_EVENT = "matrundan:demo-state-changed";
export const EXAMPLE_GUEST_PROPOSAL_STORAGE_KEY = `${EXAMPLE_STATE_STORAGE_KEY}.guestParticipationProposals.v1`;

export type ExampleGuestProposalStatus = "deferred" | "declined";

export interface PersistDemoStateOptions {
  preserveView?: boolean;
}

export interface DemoStateChangedDetail {
  preserveView: boolean;
}

function readExampleGuestProposalState(): Record<string, ExampleGuestProposalStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(EXAMPLE_GUEST_PROPOSAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, ExampleGuestProposalStatus] =>
          entry[1] === "deferred" || entry[1] === "declined",
      ),
    );
  } catch {
    return {};
  }
}

export function readExampleGuestProposalStatus(visitId: string): ExampleGuestProposalStatus | null {
  return readExampleGuestProposalState()[visitId] ?? null;
}

export function persistExampleGuestProposalStatus(
  visitId: string,
  status: ExampleGuestProposalStatus | null,
): void {
  if (typeof window === "undefined") return;
  const next = readExampleGuestProposalState();
  if (status) next[visitId] = status;
  else delete next[visitId];

  if (Object.keys(next).length === 0) {
    window.sessionStorage.removeItem(EXAMPLE_GUEST_PROPOSAL_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(EXAMPLE_GUEST_PROPOSAL_STORAGE_KEY, JSON.stringify(next));
}

export function clearExampleGuestProposalState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(EXAMPLE_GUEST_PROPOSAL_STORAGE_KEY);
}

export function persistDemoState(
  state: AppState,
  exampleMode: boolean,
  options: PersistDemoStateOptions = {},
): void {
  if (typeof window === "undefined") {
    throw new Error("Demo-data kan bara sparas i webbläsaren.");
  }

  const storage = exampleMode ? window.sessionStorage : window.localStorage;
  const key = exampleMode ? EXAMPLE_STATE_STORAGE_KEY : SANDBOX_STATE_STORAGE_KEY;
  storage.setItem(key, JSON.stringify(state));
  window.dispatchEvent(
    new CustomEvent<DemoStateChangedDetail>(DEMO_STATE_CHANGED_EVENT, {
      detail: { preserveView: options.preserveView === true },
    }),
  );
}
