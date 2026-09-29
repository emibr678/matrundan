import {
  createFileRoute,
  Link,
  Outlet,
  retainSearchParams,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { CalendarDays, Home, MapPin, MoveLeft } from "lucide-react";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  getPersonalJourneyNavigationState,
  groupHomePath,
} from "@/lib/matrundan/personal-journey-routes";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

const personalJourneySearchSchema = z.object({
  demo: z.literal(1).optional(),
});

const PERSONAL_NAV = [
  { to: "/min-matresa", label: "Översikt", icon: Home },
  { to: "/min-matresa/matstallen", label: "Matställen", icon: MapPin },
  { to: "/min-matresa/besok", label: "Besök", icon: CalendarDays },
] as const;

export const Route = createFileRoute("/min-matresa")({
  validateSearch: zodValidator(personalJourneySearchSchema),
  search: { middlewares: [retainSearchParams(["demo"])] },
  component: PersonalJourneyLayout,
});

function PersonalJourneyLayout() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const { state } = useStore();
  const { mode, exampleMode, activeGroupId, userGroups, selectGroup } = useSession();
  const navigationState = getPersonalJourneyNavigationState(location.state);
  const returnContext = navigationState.returnContext;
  const activeGroup =
    mode === "live" ? userGroups.find((group) => group.id === activeGroupId) ?? null : null;
  const fallbackGroup =
    mode === "live"
      ? (activeGroup ??
          userGroups.find((group) => group.lifecycleStatus === "active") ??
          userGroups[0] ??
          null)
      : null;
  const groupName = activeGroup?.name ?? fallbackGroup?.name ?? state.group.name ?? "gruppen";

  function keepReturnContext(previous: typeof location.state) {
    return {
      ...previous,
      personalJourney: returnContext ? { returnContext } : undefined,
    };
  }

  function exitPersonalJourney() {
    const storedGroup =
      mode === "live" && returnContext?.groupId
        ? userGroups.find((group) => group.id === returnContext.groupId) ?? null
        : null;
    const canUseStoredReturn = Boolean(
      returnContext && (mode === "demo" || (mode === "live" && storedGroup)),
    );

    if (canUseStoredReturn && returnContext) {
      if (storedGroup && storedGroup.id !== activeGroupId) {
        selectGroup(storedGroup.id);
      }
      void navigate({
        href: returnContext.href,
        state: (previous) => ({ ...previous, personalJourney: undefined }),
      });
      return;
    }

    if (fallbackGroup && fallbackGroup.id !== activeGroupId) {
      selectGroup(fallbackGroup.id);
    }
    void navigate({
      to: groupHomePath(exampleMode),
      state: (previous) => ({ ...previous, personalJourney: undefined }),
    });
  }

  const pathname = location.pathname;

  return (
    <>
      <header className="mx-auto max-w-3xl pb-1 pt-1">
        <Button
          type="button"
          variant="ghost"
          className="-ml-2 min-h-11 max-w-full rounded-full px-3"
          onClick={exitPersonalJourney}
        >
          <MoveLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Till {groupName}</span>
        </Button>

        <div className="mt-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Personligt</p>
          <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">Min matresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Samlat från dina grupper.</p>
        </div>

        <nav
          aria-label="Min matresa"
          className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-border/70 bg-background/70 p-1 shadow-sm"
        >
          {PERSONAL_NAV.map((item) => {
            const active =
              item.to === "/min-matresa"
                ? pathname === "/min-matresa"
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                state={keepReturnContext}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-colors sm:text-sm",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <Outlet />
    </>
  );
}
