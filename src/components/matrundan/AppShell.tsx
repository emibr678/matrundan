import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, MapPin, Users } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/lib/matrundan/store";

const NAV = [
  { to: "/", label: "Hem", icon: Home },
  { to: "/matstallen", label: "Matställen", icon: MapPin },
  { to: "/gruppen", label: "Gruppen", icon: Users },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <StoreProvider>
      <div className="paper-grain min-h-screen text-foreground">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col pb-24">
          <header className="flex items-center justify-between px-5 pt-6 pb-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="font-display text-xl font-semibold tracking-tight">
                Matrundan
              </span>
            </Link>
            <div className="text-xs text-muted-foreground">Fredagsgänget · Göteborg</div>
          </header>

          <main className="flex-1 px-4">
            <Outlet />
          </main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto grid max-w-2xl grid-cols-3">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    "flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-5 w-5",
                      active ? "stroke-[2.4]" : "stroke-[1.8]",
                    ].join(" ")}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <Toaster position="top-center" richColors />
      </div>
    </StoreProvider>
  );
}
