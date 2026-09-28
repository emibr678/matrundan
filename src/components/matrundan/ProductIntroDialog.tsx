import * as React from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Flag,
  Info,
  Search,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AboutDialog } from "./AboutDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import {
  shouldAutoShowCoreIntro,
  USER_GUIDANCE,
} from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";

export const OPEN_PRODUCT_INTRO_EVENT = "matrundan:open-product-intro";
export const PREVIEW_PRODUCT_INTRO_EVENT = "matrundan:preview-product-intro";

type TourMode = "automatic" | "replay";

const ProductTourActiveContext = React.createContext(false);

export function useProductTourActive() {
  return React.useContext(ProductTourActiveContext);
}

const TOUR_STEPS = [
  {
    label: "Matrundan",
    title: "Välkommen till Matrundan",
    description: (groupName: string) => (
      <>
        Upptäck, prova och minns matställen tillsammans. I Matrundan kan du ha
        olika privata grupper – för familjen, kompisgänget eller en plats ni
        vill utforska. Varje grupp har sin egen samling, sina egna planer och
        sin egen historik.
        <span className="mt-2 block font-medium text-foreground [overflow-wrap:anywhere]">
          Du är just nu i {groupName}.
        </span>
      </>
    ),
  },
  {
    label: "Matställen",
    title: "Samla matställen tillsammans",
    description: () =>
      "Här bygger ni gruppens gemensamma samling av ställen ni vill prova, redan har besökt eller gärna återvänder till. När någon eller några i gruppen har varit där registrerar ni besöket och vilka som var med.",
  },
  {
    label: "Hem",
    title: "Se vad gruppen har på gång",
    description: () => (
      <>
        När ni planerar tillsammans kan ni markera ett ställe som{" "}
        <strong className="font-medium text-foreground">Nästa stopp</strong>. På
        Hem ser ni vad som står på tur, hur mycket av samlingen ni har provat
        och gruppens senaste besök.
      </>
    ),
  },
  {
    label: "Gruppen",
    title: "Se människorna bakom rundan",
    description: () =>
      "Här ser ni vilka som är med, medlemmarnas favoriter och framsteg samt vad som har hänt i gruppen.",
  },
] as const;

function tourRoute(step: number, exampleMode: boolean) {
  if (step <= 1) return "/matstallen" as const;
  if (step === 2) return exampleMode ? ("/exempel" as const) : ("/" as const);
  return "/gruppen" as const;
}

function homeRoute(exampleMode: boolean) {
  return exampleMode ? ("/exempel" as const) : ("/" as const);
}

function tourStepForPath(pathname: string, exampleMode: boolean) {
  if (pathname === "/matstallen") return 1;
  if (pathname === homeRoute(exampleMode)) return 2;
  if (pathname === "/gruppen") return 3;
  return null;
}

function focusMainContent() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    document.getElementById("innehall")?.focus({ preventScroll: true });
  });
}

export function openProductIntro() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PRODUCT_INTRO_EVENT));
}

export function previewProductIntro() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PREVIEW_PRODUCT_INTRO_EVENT));
}

function IntroRow({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/70">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  );
}

export function ProductIntroDialog({
  open,
  onOpenChange,
  groupName,
  onOpenAbout,
  onStartTour,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  onOpenAbout: () => void;
  onStartTour: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">
            Så funkar Matrundan
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Upptäck, prova och minns matställen tillsammans i privata grupper.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <IntroRow icon={UsersRound} title="Olika grupper för olika sammanhang">
            Ha separata grupper för exempelvis familjen, kompisgänget eller en
            plats ni vill utforska. Varje grupp har sin egen samling, sina egna
            planer och sin egen historik.
          </IntroRow>
          <IntroRow icon={Search} title="Samla matställen">
            Bygg en gemensam samling av ställen ni vill prova, redan har besökt
            eller gärna återvänder till.
          </IntroRow>
          <IntroRow icon={Flag} title="Välj nästa stopp">
            När ni planerar tillsammans kan ni markera vilket ställe som står
            på tur.
          </IntroRow>
          <IntroRow icon={BookOpen} title="Registrera besök">
            När någon eller några i gruppen har varit där sparar ni besöket och
            vilka som var med. Omdömen och bilder hjälper er att minnas, hitta
            favoriter och välja nästa gång.
          </IntroRow>
        </div>

        <Card className="rounded-2xl border-0 bg-secondary/25 px-4 py-3 shadow-none">
          <div className="text-sm font-medium [overflow-wrap:anywhere]">
            Du är just nu i {groupName}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Byt grupp i menyn när du vill.
          </p>
        </Card>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onOpenAbout}>
            <Info className="h-4 w-4" aria-hidden />
            Om Matrundan
          </Button>
          <Button type="button" onClick={onStartTour}>
            Visa rundtur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductTourCard({
  step,
  groupName,
  onNext,
  onSkip,
}: {
  step: number;
  groupName: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <aside
      data-product-tour
      aria-label="Introduktion till Matrundan"
      className="fixed inset-x-3 bottom-[5.75rem] z-[60] mx-auto max-w-md rounded-3xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md md:bottom-6"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{current.label}</span>
        <span>
          {step + 1} av {TOUR_STEPS.length}
        </span>
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 font-display text-xl font-semibold outline-none"
      >
        {current.title}
      </h2>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {current.description(groupName)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Hoppa över
        </Button>
        <Button type="button" onClick={onNext}>
          {last ? "Nu kör vi" : "Nästa"}
        </Button>
      </div>
    </aside>
  );
}

export function ProductIntroController({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { state } = useStore();
  const {
    mode,
    exampleMode,
    user,
    activeGroupId,
    activeGroupLifecycleStatus,
    pendingGroupInvitations,
    pendingGroupInvitationsReady,
  } = useSession();
  const router = useRouter();
  const pathname = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });
  const { status, isAcknowledged, acknowledge } = useUserGuidance();
  const [open, setOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [tourMode, setTourMode] = React.useState<TourMode | null>(null);
  const [tourStep, setTourStep] = React.useState(0);
  const autoHandledUsers = React.useRef(new Set<string>());
  const tourNavigationTarget = React.useRef<string | null>(null);
  const coreIntroAcknowledged = isAcknowledged(USER_GUIDANCE.coreIntro);

  const acknowledgeTourIfNeeded = React.useCallback(
    (currentMode: TourMode | null) => {
      if (currentMode === "automatic" && mode === "live") {
        void acknowledge(USER_GUIDANCE.coreIntro);
      }
    },
    [acknowledge, mode],
  );

  const navigateWithinTour = React.useCallback(
    (to: ReturnType<typeof tourRoute>) => {
      tourNavigationTarget.current = to;
      void router.navigate({ to, replace: true });
    },
    [router],
  );

  const startTour = React.useCallback(
    (nextMode: TourMode) => {
      const firstRoute = tourRoute(0, exampleMode);
      setOpen(false);
      setTourStep(0);
      tourNavigationTarget.current = firstRoute;
      setTourMode(nextMode);
      void router.navigate({ to: firstRoute, replace: true });
    },
    [exampleMode, router],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const openIntro = () => {
      setTourMode(null);
      setOpen(true);
    };
    const previewIntro = () => startTour("automatic");
    window.addEventListener(OPEN_PRODUCT_INTRO_EVENT, openIntro);
    window.addEventListener(PREVIEW_PRODUCT_INTRO_EVENT, previewIntro);
    return () => {
      window.removeEventListener(OPEN_PRODUCT_INTRO_EVENT, openIntro);
      window.removeEventListener(PREVIEW_PRODUCT_INTRO_EVENT, previewIntro);
    };
  }, [startTour]);

  React.useEffect(() => {
    const userId = user?.id;
    if (
      !shouldAutoShowCoreIntro({
        isLive: mode === "live",
        hasUser: Boolean(userId),
        hasActiveGroup:
          Boolean(activeGroupId) && activeGroupLifecycleStatus === "active",
        onHomeRoute: pathname === "/",
        pendingInvitationsReady: pendingGroupInvitationsReady,
        pendingInvitationCount: pendingGroupInvitations.length,
        guidanceReady: status === "ready",
        acknowledged: coreIntroAcknowledged,
        alreadyHandled: userId
          ? autoHandledUsers.current.has(userId)
          : false,
      }) ||
      !userId
    ) {
      return;
    }

    autoHandledUsers.current.add(userId);
    startTour("automatic");
  }, [
    activeGroupId,
    activeGroupLifecycleStatus,
    coreIntroAcknowledged,
    mode,
    pathname,
    pendingGroupInvitations.length,
    pendingGroupInvitationsReady,
    startTour,
    status,
    user?.id,
  ]);

  React.useEffect(() => {
    if (mode === "live" && tourMode && (!user || !activeGroupId)) {
      tourNavigationTarget.current = null;
      setTourMode(null);
    }
  }, [activeGroupId, mode, tourMode, user]);

  React.useEffect(() => {
    if (!tourMode) {
      tourNavigationTarget.current = null;
      return;
    }

    const pendingTarget = tourNavigationTarget.current;
    if (pendingTarget) {
      if (pathname !== pendingTarget) return;
      tourNavigationTarget.current = null;
    }

    const routeStep = tourStepForPath(pathname, exampleMode);
    if (routeStep !== null) {
      if (tourStep === 0 && pathname === tourRoute(0, exampleMode)) return;
      setTourStep((current) =>
        current === routeStep ? current : routeStep,
      );
      return;
    }

    acknowledgeTourIfNeeded(tourMode);
    setTourMode(null);
    focusMainContent();
  }, [
    acknowledgeTourIfNeeded,
    exampleMode,
    pathname,
    tourStep,
    tourMode,
  ]);

  function skipTour() {
    acknowledgeTourIfNeeded(tourMode);
    tourNavigationTarget.current = null;
    setTourMode(null);
    focusMainContent();
  }

  function nextTourStep() {
    if (tourStep >= TOUR_STEPS.length - 1) {
      acknowledgeTourIfNeeded(tourMode);
      tourNavigationTarget.current = null;
      setTourMode(null);
      void router
        .navigate({ to: homeRoute(exampleMode), replace: true })
        .then(focusMainContent);
      return;
    }

    if (tourStep === 0) {
      setTourStep(1);
      return;
    }

    navigateWithinTour(tourRoute(tourStep + 1, exampleMode));
  }

  function handleOpenAbout() {
    setOpen(false);
    setAboutOpen(true);
  }

  return (
    <ProductTourActiveContext.Provider value={tourMode !== null}>
      {children}
      <ProductIntroDialog
        open={open}
        onOpenChange={setOpen}
        groupName={state.group.name}
        onOpenAbout={handleOpenAbout}
        onStartTour={() => startTour("replay")}
      />
      {tourMode ? (
        <ProductTourCard
          step={tourStep}
          groupName={state.group.name}
          onNext={nextTourStep}
          onSkip={skipTour}
        />
      ) : null}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </ProductTourActiveContext.Provider>
  );
}
