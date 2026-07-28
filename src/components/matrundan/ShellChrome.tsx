import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Archive, Home, Info, MapPin, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthMenu } from "@/components/matrundan/AuthMenu";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

const NAV = [
  { to: "/", label: "Hem", icon: Home },
  { to: "/matstallen", label: "Matställen", icon: MapPin },
  { to: "/gruppen", label: "Gruppen", icon: Users },
] as const;

type NavTarget = "/" | "/exempel" | "/matstallen" | "/gruppen";

export function ShellChrome({ exampleMode }: { exampleMode: boolean }) {
  const { state, resetDemo } = useStore();
  const { signInWithGoogle } = useSession();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const homeTarget: NavTarget = exampleMode ? "/exempel" : "/";
  const targetFor = (to: (typeof NAV)[number]["to"]): NavTarget => (to === "/" ? homeTarget : to);
  const isActive = (to: string) =>
    to === "/"
      ? pathname === "/" || (exampleMode && pathname === "/exempel")
      : pathname.startsWith(to);
  const archived = state.group.lifecycleStatus === "archived";

  async function createOwnGroup() {
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Kunde inte starta Google-inloggningen.");
    }
  }

  function resetExample() {
    resetDemo();
    toast.success("Exempelgruppen är återställd.");
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
            <AuthMenu showGroupActions />
          </div>
        </header>

        <main id="innehall" className="flex-1 px-4 md:px-6">
          {exampleMode ? (
            <div
              role="status"
              className="mx-auto mb-4 flex max-w-4xl flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 text-sm lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="font-medium">Exempelgrupp · Stockholm</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Fredagsgänget och historiken är exempeldata. Matställena är verkliga och dina
                    ändringar sparas bara tillfälligt i den här fliken.
                  </p>
                </div>
              </div>
              <div className="grid w-full shrink-0 grid-cols-2 gap-2 lg:flex lg:w-auto">
                <Button variant="ghost" size="sm" className="min-h-10" onClick={resetExample}>
                  <RotateCcw className="h-4 w-4" /> Återställ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() => void createOwnGroup()}
                >
                  Skapa egen grupp
                </Button>
              </div>
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
