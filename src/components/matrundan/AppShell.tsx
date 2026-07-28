import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Archive, Home, Info, MapPin, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { StoreProvider, useStore } from "@/lib/matrundan/store";
import { SessionProvider, useSession, consumePendingInvitePath } from "@/lib/matrundan/session";
import { loadLiveState } from "@/lib/matrundan/live-repository";
import { EXAMPLE_STATE } from "@/lib/matrundan/example-data";
import { LandingScreen } from "@/components/matrundan/LandingScreen";
import { OnboardingScreen } from "@/components/matrundan/OnboardingScreen";
import { AuthMenu } from "@/components/matrundan/AuthMenu";
import type { AppState } from "@/lib/matrundan/types";

const NAV = [
  { to: "/", label: "Hem", icon: Home },
  { to: "/matstallen", label: "Matställen", icon: MapPin },
  { to: "/gruppen", label: "Gruppen", icon: Users },
] as const;

export function AppShell() {
  return (
    <SessionProvider>
      <ShellBody />
      <Toaster position="top-center" richColors />
    </SessionProvider>
  );
}

function ShellBody() {
  const { loading, mode, demoReadOnly, needsOnboarding, activeGroupId, user } = useSession();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isInvitationRoute = pathname.startsWith("/inbjudan/");
  const [liveState, setLiveState] = React.useState<AppState | null>(null);
  const [liveError, setLiveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    const pending = consumePendingInvitePath();
    if (pending && pending.startsWith("/") && !pending.startsWith("//")) {
      void router.navigate({ to: pending });
    }
  }, [user, router]);

  const reloadLive = React.useCallback(async () => {
    if (mode !== "live" || !activeGroupId) return;
    try {
      const nextState = await loadLiveState(activeGroupId);
      setLiveState(nextState);
      setLiveError(null);
    } catch (error) {
      console.error(error);
      setLiveError("Kunde inte läsa gruppens data.");
    }
  }, [mode, activeGroupId]);

  React.useEffect(() => {
    let cancelled = false;
    if (mode !== "live" || !activeGroupId) {
      setLiveState(null);
      return;
    }
    setLiveError(null);
    loadLiveState(activeGroupId)
      .then((nextState) => {
        if (!cancelled) setLiveState(nextState);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLiveError("Kunde inte läsa gruppens data.");
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

  if (loading) {
    return (
      <div className="paper-grain flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (isInvitationRoute) {
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
          {liveError ?? "Hämtar gruppens data…"}
        </div>
      </div>
    );
  }

  const storeMode = mode === "live" ? "live" : "demo";

  return (
    <StoreProvider
      key={mode === "live" ? `live:${activeGroupId ?? ""}` : `demo:${demoReadOnly ? "example" : "sandbox"}`}
      mode={storeMode}
      demoReadOnly={demoReadOnly}
      initialState={
        mode === "live" ? (liveState ?? undefined) : demoReadOnly ? EXAMPLE_STATE : undefined
      }
      onLiveMutation={mode === "live" ? reloadLive : undefined}
      activeGroupId={mode === "live" ? activeGroupId : null}
    >
      <ShellChrome demoReadOnly={demoReadOnly} />
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

function ShellChrome({ demoReadOnly }: { demoReadOnly: boolean }) {
  const { state } = useStore();
  const { mode, signInWithGoogle } = useSession();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const homeTarget = demoReadOnly ? "/exempel" : "/";
  const targetFor = (to: (typeof NAV)[number]["to"]) => (to === "/" ? homeTarget : to);
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" || (demoReadOnly && pathname === "/exempel") : pathname.startsWith(to);
  const archived = state.group.lifecycleStatus === "archived";

  async function createOwnGroup() {
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Kunde inte starta Google-inloggningen.");
    }
  }

  return (
    <div className="paper-grain min-h-dvh text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col pb-24 md:pb-8">
        <header className="flex items-center justify-between gap-4 px-5 pt-6 pb-3 md:pt-8">
          <Link to={homeTarget} className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <span className="font-display text-xl font-semibold tracking-tight">Matrundan</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Huvudmeny">
            {NAV.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={targetFor(item.to)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <AuthMenu showGroupActions={mode === "live"} />
          </div>
        </header>

        <main id="innehall" className="flex-1 px-4 md:px-6">
          {demoReadOnly ? (
            <div
              role="status"
              className="mx-auto mb-4 flex max-w-4xl flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="font-medium">Exempelgrupp · Stockholm</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Fredagsgänget är fiktivt och skrivskyddat. Matställena är verkliga, men besök,
                    omdömen och medlemskap är exempeldata.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 w-full shrink-0 sm:w-auto"
                onClick={() => void createOwnGroup()}
              >
                Skapa egen grupp
              </Button>
            </div>
          ) : archived ? (
            <div
              role="status"
              className="mx-auto mb-4 flex max-w-4xl items-start gap-3 rounded-2xl border border-border/70 bg-muted/55 p-3 text-sm"
            >
              <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium">Gruppen är arkiverad</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Historiken är bevarad och kan läsas. Återaktivera gruppen i gruppmenyn för att
                  lägga till eller ändra något.
                </p>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Huvudmeny"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/85 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-3">
          {NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={targetFor(item.to)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-11 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Icon className={["h-5 w-5", active ? "stroke-[2.4]" : "stroke-[1.8]"].join(" ")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
