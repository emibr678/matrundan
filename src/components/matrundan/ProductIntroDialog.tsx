import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
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
  automatic,
  groupName,
  onOpenAbout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automatic: boolean;
  groupName: string;
  onOpenAbout: () => void;
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
            för olika gäng och sammanhang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <IntroRow icon={UsersRound} title="Flera grupper, olika sammanhang">
            Skapa separata grupper för olika gäng och platser – till exempel
            familjen, kompisgänget, närområdet eller en stad där du bor eller
            ska resa till. Varje grupp har sin egen lista och historik.
          </IntroRow>
          <IntroRow icon={Search} title="Samla ställen ni vill prova">
            Spara restauranger, caféer och andra ställen gruppen är nyfiken på.
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
            Byt grupp i menyn när du vill se ett annat gängs ställen, planer och
            historik.
          </p>
        </Card>

        <DialogFooter>
          {!automatic ? (
            <Button type="button" variant="ghost" onClick={onOpenAbout}>
              <Info className="h-4 w-4" aria-hidden />
              Om Matrundan
            </Button>
          ) : null}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {automatic ? "Till gruppen" : "Stäng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductIntroController() {
  const { state } = useStore();
  const {
    mode,
    user,
    activeGroupId,
    activeGroupLifecycleStatus,
    pendingGroupInvitations,
    pendingGroupInvitationsReady,
  } = useSession();
  const pathname = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });
  const { status, isAcknowledged, acknowledge } = useUserGuidance();
  const [open, setOpen] = React.useState(false);
  const [automatic, setAutomatic] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const autoHandledUsers = React.useRef(new Set<string>());
  const coreIntroAcknowledged = isAcknowledged(USER_GUIDANCE.coreIntro);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const openIntro = () => {
      setAutomatic(false);
      setOpen(true);
    };
    const previewIntro = () => {
      setAutomatic(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_PRODUCT_INTRO_EVENT, openIntro);
    window.addEventListener(PREVIEW_PRODUCT_INTRO_EVENT, previewIntro);
    return () => {
      window.removeEventListener(OPEN_PRODUCT_INTRO_EVENT, openIntro);
      window.removeEventListener(PREVIEW_PRODUCT_INTRO_EVENT, previewIntro);
    };
  }, []);

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
        alreadyHandled: userId ? autoHandledUsers.current.has(userId) : false,
      }) ||
      !userId
    ) {
      return;
    }

    autoHandledUsers.current.add(userId);
    setAutomatic(true);
    setOpen(true);
  }, [
    activeGroupId,
    activeGroupLifecycleStatus,
    coreIntroAcknowledged,
    mode,
    pathname,
    pendingGroupInvitations.length,
    pendingGroupInvitationsReady,
    status,
    user?.id,
  ]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && mode === "live" && !coreIntroAcknowledged) {
      void acknowledge(USER_GUIDANCE.coreIntro);
    }
    setOpen(nextOpen);
    if (!nextOpen) setAutomatic(false);
  }

  function handleOpenAbout() {
    handleOpenChange(false);
    setAboutOpen(true);
  }

  return (
    <>
      <ProductIntroDialog
        open={open}
        onOpenChange={handleOpenChange}
        automatic={automatic}
        groupName={state.group.name}
        onOpenAbout={handleOpenAbout}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
