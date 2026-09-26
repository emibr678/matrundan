import * as React from "react";
import { BookOpen, Flag, Search, UsersRound, type LucideIcon } from "lucide-react";
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
import { hasSeenOnboarding, markOnboardingSeen, shouldAutoShowProductIntro } from "@/lib/matrundan/onboarding-state";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

export const OPEN_PRODUCT_INTRO_EVENT = "matrundan:open-product-intro";

export function openProductIntro() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PRODUCT_INTRO_EVENT));
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
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function ProductIntroDialog({
  open,
  onOpenChange,
  automatic,
  groupName,
  placeCount,
  visitCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automatic: boolean;
  groupName: string;
  placeCount: number;
  visitCount: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">Så funkar Matrundan</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Upptäck, prova och minns matställen tillsammans – i privata grupper för olika gäng och sammanhang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <IntroRow icon={UsersRound} title="Ha olika grupper för olika gäng">
            Du kan till exempel ha en grupp med familjen, vännerna eller kollegorna. Varje grupp har sin egen lista och historik.
          </IntroRow>
          <IntroRow icon={Search} title="Samla ställen ni vill prova">
            Spara restauranger, caféer och andra ställen gruppen är nyfiken på.
          </IntroRow>
          <IntroRow icon={Flag} title="Välj vart ni ska härnäst">
            Lägg ett ställe som Nästa stopp när ni har bestämt vad som står på tur.
          </IntroRow>
          <IntroRow icon={BookOpen} title="Spara det ni faktiskt gjorde">
            Registrera besöket och vilka som var med. Omdömen, bilder och återbesök bygger gruppens gemensamma mathistoria.
          </IntroRow>
        </div>

        <Card className="rounded-2xl border-border/70 bg-secondary/25 p-4">
          <div className="text-sm font-medium [overflow-wrap:anywhere]">Du är i {groupName}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Byt grupp i menyn när du vill se ett annat gängs ställen, planer och historik.
          </p>
        </Card>

        <DialogFooter>
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
  const { mode, user, activeGroupId, activeGroupLifecycleStatus } = useSession();
  const [open, setOpen] = React.useState(false);
  const [automatic, setAutomatic] = React.useState(false);
  const autoHandledUsers = React.useRef(new Set<string>());

  const activePlaces = React.useMemo(
    () => state.places.filter((place) => place.collectionStatus !== "archived"),
    [state.places],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const openIntro = () => {
      setAutomatic(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_PRODUCT_INTRO_EVENT, openIntro);
    return () => window.removeEventListener(OPEN_PRODUCT_INTRO_EVENT, openIntro);
  }, []);

  React.useEffect(() => {
    const userId = user?.id;
    if (
      mode !== "live" ||
      !userId ||
      !activeGroupId ||
      activeGroupLifecycleStatus !== "active" ||
      autoHandledUsers.current.has(userId)
    ) {
      return;
    }

    autoHandledUsers.current.add(userId);
    if (!shouldAutoShowProductIntro(user.created_at)) return;
    if (hasSeenOnboarding("product-intro", userId)) return;
    setAutomatic(true);
    setOpen(true);
  }, [activeGroupId, activeGroupLifecycleStatus, mode, user?.id]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && automatic) {
      markOnboardingSeen("product-intro", user?.id);
    }
    setOpen(nextOpen);
    if (!nextOpen) setAutomatic(false);
  }

  return (
    <ProductIntroDialog
      open={open}
      onOpenChange={handleOpenChange}
      automatic={automatic}
      groupName={state.group.name}
      placeCount={activePlaces.length}
      visitCount={state.visits.length}
    />
  );
}
