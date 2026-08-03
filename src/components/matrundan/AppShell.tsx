import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import { AuthMenu } from "@/components/matrundan/AuthMenu";
import { LandingScreen } from "@/components/matrundan/LandingScreen";
import { OnboardingScreen } from "@/components/matrundan/OnboardingScreen";
import { ShellChrome } from "@/components/matrundan/ShellChrome";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { DEMO_STATE_CHANGED_EVENT, EXAMPLE_STATE_STORAGE_KEY } from "@/lib/matrundan/demo-state";
import { EXAMPLE_STATE } from "@/lib/matrundan/example-data";
import { loadLiveState } from "@/lib/matrundan/live-repository";
import { SessionProvider, consumePendingInvitePath, useSession } from "@/lib/matrundan/session";
import { StoreProvider } from "@/lib/matrundan/store";
import type { AppState } from "@/lib/matrundan/types";

const LIVE_LOAD_ERROR = "Kunde inte läsa gruppens data.";

function requireLiveState(state: AppState | null): AppState {
  if (!state) throw new Error(LIVE_LOAD_ERROR);
  return state;
}

export function AppShell() {
  return (
    <SessionProvider>
      <ShellBody />
      <Toaster position="top-center" richColors />
    </SessionProvider>
  );
}

function ShellBody() {
  const { loading, mode, exampleMode, needsOnboarding, activeGroupId, user } = useSession();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isInvitationRoute = pathname.startsWith("/inbjudan/");
  const isPublicInfoRoute = pathname === "/integritet";
  const [liveState, setLiveState] = React.useState<AppState | null>(null);
  const [liveError, setLiveError] = React.useState<string | null>(null);
  const [demoRevision, setDemoRevision] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    const pending = consumePendingInvitePath();
    if (pending && pending.startsWith("/") && !pending.startsWith("//")) {
      void router.navigate({ to: pending });
    }
  }, [user, router]);

  const reloadLive = React.useCallback(async () => {
    if (mode !== "live" || !activeGroupId) return;
    setLiveError(null);
    try {
      const nextState = requireLiveState(await loadLiveState(activeGroupId));
      setLiveState(nextState);
    } catch (error) {
      console.error(error);
      setLiveError(LIVE_LOAD_ERROR);
    }
  }, [mode, activeGroupId]);

  React.useEffect(() => {
    let cancelled = false;
    if (mode !== "live" || !activeGroupId) {
      setLiveState(null);
      setLiveError(null);
      return;
    }
    setLiveState(null);
    setLiveError(null);
    loadLiveState(activeGroupId)
      .then((nextState) => requireLiveState(nextState))
      .then((nextState) => {
        if (!cancelled) setLiveState(nextState);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLiveError(LIVE_LOAD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, activeGroupId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => void reloadLive();
    window.addEventListener("matrundan:reload", handler);
    return () => window.removeEventListener("matrundan:reload", handler);
  }, [reloadLive]);

  React.useEffect(() => {
    if (typeof window === "undefined" || mode === "live") return;
    const handler = () => setDemoRevision((current) => current + 1);
    window.addEventListener(DEMO_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DEMO_STATE_CHANGED_EVENT, handler);
  }, [mode]);

  if (loading) {
    return (
      <div className="paper-grain flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (isInvitationRoute || isPublicInfoRoute) {
    return (
      <div className="paper-grain min-h-dvh">
        <Header showAuth />
        <main id="innehall" className="mx-auto max-w-6xl px-4 md:px-6">
          <Outlet />
        </main>
      </div>
    );
  }

  if (mode === "landing") {
    return (
      <div className="paper-grain min-h-dvh">
        <Header showAuth />
        <LandingScreen />
      </div>
    );
  }

  if (mode === "live" && needsOnboarding) {
    return (
      <div className="paper-grain min-h-dvh">
        <Header showAuth />
        <OnboardingScreen />
      </div>
    );
  }

  if (mode === "live" && !liveState) {
    return (
      <div className="paper-grain min-h-dvh">
        <Header showAuth />
        <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-muted-foreground">
          {liveError ? (
            <div className="space-y-4">
              <p>{liveError}</p>
              <Button type="button" variant="outline" onClick={() => void reloadLive()}>
                Försök igen
              </Button>
            </div>
          ) : (
            <p>Hämtar gruppens data…</p>
          )}
        </div>
      </div>
    );
  }

  const storeMode = mode === "live" ? "live" : "demo";

  return (
    <StoreProvider
      key={
        mode === "live"
          ? `live:${activeGroupId ?? ""}`
          : `demo:${exampleMode ? "example" : "sandbox"}:${demoRevision}`
      }
      mode={storeMode}
      demoPersistence={exampleMode ? "session" : "local"}
      demoStorageKey={exampleMode ? EXAMPLE_STATE_STORAGE_KEY : undefined}
      initialState={
        mode === "live" ? (liveState ?? undefined) : exampleMode ? EXAMPLE_STATE : undefined
      }
      onLiveMutation={mode === "live" ? reloadLive : undefined}
      activeGroupId={mode === "live" ? activeGroupId : null}
    >
      <ShellChrome exampleMode={exampleMode} />
    </StoreProvider>
  );
}

function Header({ showAuth }: { showAuth: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-6 pb-3 md:pt-8">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-2xl">🍽️</span>
        <span className="font-display text-xl font-semibold tracking-tight">Matrundan</span>
      </Link>
      {showAuth ? <AuthMenu /> : null}
    </header>
  );
}
