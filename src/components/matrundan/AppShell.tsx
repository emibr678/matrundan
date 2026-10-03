import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import { AuthMenu } from "@/components/matrundan/AuthMenu";
import { LandingScreen } from "@/components/matrundan/LandingScreen";
import { EnvironmentBadge } from "@/components/matrundan/EnvironmentBadge";
import { MatrundanBrand } from "@/components/matrundan/MatrundanBrand";
import { OnboardingScreen } from "@/components/matrundan/OnboardingScreen";
import { ProductIntroController } from "@/components/matrundan/ProductIntroDialog";
import { ShellChrome } from "@/components/matrundan/ShellChrome";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { DEMO_STATE } from "@/lib/matrundan/demo-data";
import {
  DEMO_STATE_CHANGED_EVENT,
  EXAMPLE_STATE_STORAGE_KEY,
  type DemoStateChangedDetail,
} from "@/lib/matrundan/demo-state";
import { createExampleState } from "@/lib/matrundan/example-data";
import { LiveGroupCache } from "@/lib/matrundan/live-group-cache";
import { loadLiveGroup } from "@/lib/matrundan/live-repository";
import { SessionProvider, consumePendingInvitePath, useSession } from "@/lib/matrundan/session";
import { StoreProvider } from "@/lib/matrundan/store";
import { UserGuidanceProvider } from "@/lib/matrundan/user-guidance-context";

export function AppShell() {
  return (
    <SessionProvider>
      <UserGuidanceProvider>
        <ShellBody />
      </UserGuidanceProvider>
      <Toaster position="top-center" richColors />
    </SessionProvider>
  );
}

function ShellBody() {
  const {
    loading,
    mode,
    exampleMode,
    needsOnboarding,
    activeGroupId,
    user,
    userGroups,
    groupsStatus,
    sessionEpoch,
    refreshGroups,
  } = useSession();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isInvitationRoute = pathname.startsWith("/inbjudan/");
  const isPublicStandaloneRoute = pathname === "/integritet" || pathname === "/nytt-losenord";
  const cache = React.useMemo(() => {
    // A batched logout/login can return to the same user with a new session.
    void sessionEpoch;
    return new LiveGroupCache(user?.id ?? "", loadLiveGroup);
  }, [user?.id, sessionEpoch]);
  const getSnapshot = React.useCallback(
    () => cache.getSnapshot(mode === "live" ? activeGroupId : null),
    [cache, mode, activeGroupId],
  );
  const { state: liveState, error: liveError } = React.useSyncExternalStore(
    cache.subscribe,
    getSnapshot,
    getSnapshot,
  );
  const [demoRevision, setDemoRevision] = React.useState(0);
  const [demoHydrationRevision, setDemoHydrationRevision] = React.useState(0);
  const demoInitialState = React.useMemo(() => {
    void demoHydrationRevision;
    return exampleMode ? createExampleState() : { ...DEMO_STATE };
  }, [demoHydrationRevision, exampleMode]);

  React.useEffect(() => {
    if (!user) return;
    const pending = consumePendingInvitePath();
    if (pending && pending.startsWith("/") && !pending.startsWith("//")) {
      void router.navigate({ to: pending });
    }
  }, [user, router]);

  const reloadLive = React.useCallback(async () => {
    if (mode !== "live" || !activeGroupId) return;
    cache.invalidateOthers(activeGroupId);
    await cache.load(activeGroupId, true);
  }, [cache, mode, activeGroupId]);

  React.useEffect(() => () => cache.clear(), [cache]);

  React.useEffect(() => {
    if (groupsStatus === "ready") cache.retain(userGroups.map((group) => group.id));
  }, [cache, groupsStatus, userGroups]);

  React.useEffect(() => {
    void cache.activate(mode === "live" ? activeGroupId : null);
  }, [cache, mode, activeGroupId]);

  React.useEffect(() => {
    if (mode === "live" && activeGroupId && !liveState && !liveError)
      void cache.load(activeGroupId);
  }, [cache, mode, activeGroupId, liveState, liveError]);

  React.useEffect(() => {
    if (typeof window === "undefined" || mode !== "live" || !activeGroupId) return;
    const refresh = () => {
      void cache.load(activeGroupId);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [cache, mode, activeGroupId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => void reloadLive();
    window.addEventListener("matrundan:reload", handler);
    return () => window.removeEventListener("matrundan:reload", handler);
  }, [reloadLive]);

  React.useEffect(() => {
    if (typeof window === "undefined" || mode === "live") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateChangedDetail>).detail;
      if (detail?.preserveView) {
        setDemoHydrationRevision((current) => current + 1);
        return;
      }
      setDemoRevision((current) => current + 1);
    };
    window.addEventListener(DEMO_STATE_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(DEMO_STATE_CHANGED_EVENT, handler);
    };
  }, [mode]);

  if (loading) {
    return (
      <div className="paper-grain flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (isInvitationRoute || isPublicStandaloneRoute) {
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
    const error = liveError ?? (groupsStatus === "error" ? "Kunde inte hämta dina grupper." : null);
    const retry = activeGroupId ? reloadLive : refreshGroups;
    return (
      <div className="paper-grain min-h-dvh">
        <Header showAuth />
        <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-muted-foreground">
          {error ? (
            <div className="space-y-4">
              <p>{error}</p>
              <Button type="button" variant="outline" onClick={() => void retry()}>
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
          ? `live:${user?.id ?? ""}:${sessionEpoch}:${activeGroupId ?? ""}`
          : `demo:${exampleMode ? "example" : "sandbox"}:${demoRevision}`
      }
      mode={storeMode}
      demoPersistence={exampleMode ? "session" : "local"}
      demoStorageKey={exampleMode ? EXAMPLE_STATE_STORAGE_KEY : undefined}
      initialState={mode === "live" ? (liveState ?? undefined) : demoInitialState}
      onLiveMutation={mode === "live" ? reloadLive : undefined}
      activeGroupId={mode === "live" ? activeGroupId : null}
    >
      <ProductIntroController>
        {mode === "live" && liveError ? (
          <div
            role="status"
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm text-muted-foreground"
          >
            <span>Kunde inte uppdatera gruppen.</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void reloadLive()}>
              Försök igen
            </Button>
          </div>
        ) : null}
        <ShellChrome exampleMode={exampleMode} />
      </ProductIntroController>
    </StoreProvider>
  );
}

function Header({ showAuth }: { showAuth: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pt-6 pb-3 md:gap-4 md:px-5 md:pt-8">
      <div className="flex min-w-0 flex-col items-start gap-1 md:flex-row md:items-center md:gap-1.5">
        <Link to="/" className="shrink-0">
          <MatrundanBrand />
        </Link>
        <EnvironmentBadge />
      </div>
      {showAuth ? <AuthMenu /> : null}
    </header>
  );
}
