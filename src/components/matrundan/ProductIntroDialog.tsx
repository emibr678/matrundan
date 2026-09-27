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
    label: "Matställen",
    title: "Samla matställen tillsammans",
    description:
      "Här bygger ni gruppens gemensamma samling av matställen: sådant ni vill prova, favoriter ni vill återvända till och matställen ni redan besökt. Besökta matställen ligger kvar och kan besökas igen.",
  },
  {
    label: "Hem",
    title: "Se vad gruppen har på gång",
    description: (
      <>
        När ni har bestämt vilket matställe ni vill besöka härnäst kan ni göra
        det till{" "}
        <strong className="font-medium text-foreground">Nästa stopp</strong>. På
        Hem ser ni vad som står på tur, hur mycket av er samling ni hunnit prova
        och ert senaste gemensamma besök.
      </>
    ),
  },
  {
    label: "Gruppen",
    title: "Se människorna bakom rundan",
    description:
      "Här samlas den personliga sidan av Matrundan: medlemmarnas favoriter, besök och framsteg, tillsammans med gruppens gemensamma höjdpunkter och aktivitet.",
  },
] as const;

function tourRoute(step: number, exampleMode: boolean) {
  if (step === 0) return "/matstallen" as const;
  if (step === 1) return exampleMode ? ("/exempel" as const) : ("/" as const);
  return "/gruppen" as const;
}

function homeRoute(exampleMode: boolean) {
  return exampleMode ? ("/exempel" as const) : ("/" as const);
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
            Upptäck, prova och minns matställen tillsammans – i privata grupper
            för familj, vänner och olika sammanhang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <IntroRow icon={UsersRound} title="Flera grupper, olika sammanhang">
            Skapa separata grupper för olika personer och platser – till exempel
            familjen, kompisgänget, närområdet eller en stad där du bor eller ska
            resa till. Varje grupp har sin egen lista och historik.
          </IntroRow>
          <IntroRow icon={Search} title="Samla matställen ni vill prova">
            Spara restauranger, caféer och andra matställen gruppen är nyfiken på.
          </IntroRow>
          <IntroRow icon={Flag} title="Välj nästa stopp">
            När ni har bestämt er, lägg stället som Nästa stopp så gruppen vet
            vad som står på tur.
          </IntroRow>
          <IntroRow icon={BookOpen} title="Registrera besöket">
            När ni varit där sparar ni datum och vilka som faktiskt var med.
            Omdömen, bilder och återbesök hjälper er minnas och välja nästa
            gång.
          </IntroRow>
        </div>

        <Card className="rounded-2xl border-border/70 bg-secondary/25 p-4">
          <div className="text-sm font-medium [overflow-wrap:anywhere]">
            Du är i {groupName}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Byt grupp i menyn när du vill se en annan grupps ställen, planer och
            historik.
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
  onNext,
  onSkip,
}: {
  step: number;
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
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {current.description}
      </p>
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
  const coreIntroAcknowledged = isAcknowledged(USER_GUIDANCE.coreIntro);

  const startTour = React.useCallback(
    (nextMode: TourMode) => {
      setOpen(false);
      setTourStep(0);
      setTourMode(nextMode);
      void router.navigate({ to: tourRoute(0, exampleMode) });
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
      setTourMode(null);
    }
  }, [activeGroupId, mode, tourMode, user]);

  function acknowledgeTourIfNeeded(currentMode: TourMode | null) {
    if (currentMode === "automatic" && mode === "live") {
      void acknowledge(USER_GUIDANCE.coreIntro);
    }
  }

  function skipTour() {
    acknowledgeTourIfNeeded(tourMode);
    setTourMode(null);
  }

  function nextTourStep() {
    if (tourStep >= TOUR_STEPS.length - 1) {
      acknowledgeTourIfNeeded(tourMode);
      setTourMode(null);
      void router.navigate({ to: homeRoute(exampleMode) });
      return;
    }

    const nextStep = tourStep + 1;
    setTourStep(nextStep);
    void router.navigate({ to: tourRoute(nextStep, exampleMode) });
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
          onNext={nextTourStep}
          onSkip={skipTour}
        />
      ) : null}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </ProductTourActiveContext.Provider>
  );
}
