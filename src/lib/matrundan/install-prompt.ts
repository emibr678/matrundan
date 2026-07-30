/**
 * Hjälpare för att lägga Matrundan på hemskärmen.
 * Fångar webbläsarens installationshändelse där den finns (Android/Chrome/Edge)
 * och känner igen iPhone/iPad där användaren måste göra det manuellt.
 */
import * as React from "react";

import { isInstalledApp, isIosLike } from "./notifications";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

export type InstallMode = "installed" | "prompt" | "ios-manual" | "none";

export type InstallState = {
  mode: InstallMode;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

export function useInstallPrompt(): InstallState {
  const [, forceRender] = React.useReducer((count: number) => count + 1, 0);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    listeners.add(forceRender);
    return () => {
      listeners.delete(forceRender);
    };
  }, []);

  const hasPrompt = deferredPrompt !== null;
  const mode: InstallMode = React.useMemo(() => {
    if (!hydrated) return "none";
    if (isInstalledApp()) return "installed";
    if (hasPrompt) return "prompt";
    if (isIosLike()) return "ios-manual";
    return "none";
  }, [hydrated, hasPrompt]);

  const promptInstall = React.useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return "unavailable" as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      emit();
    }
    return outcome;
  }, []);

  return { mode, promptInstall };
}
