import type { AppState } from "./types";

export const EXAMPLE_STATE_STORAGE_KEY = "matrundan.exampleState.v1";
export const SANDBOX_STATE_STORAGE_KEY = "matrundan.state.v1";
export const DEMO_STATE_CHANGED_EVENT = "matrundan:demo-state-changed";

export function persistDemoState(state: AppState, exampleMode: boolean): void {
  if (typeof window === "undefined") {
    throw new Error("Demo-data kan bara sparas i webbläsaren.");
  }

  const storage = exampleMode ? window.sessionStorage : window.localStorage;
  const key = exampleMode ? EXAMPLE_STATE_STORAGE_KEY : SANDBOX_STATE_STORAGE_KEY;
  storage.setItem(key, JSON.stringify(state));
  window.dispatchEvent(new Event(DEMO_STATE_CHANGED_EVENT));
}
