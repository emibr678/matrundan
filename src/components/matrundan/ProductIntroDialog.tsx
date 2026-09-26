import * as React from "react";
import { BookOpen, Flag, History, Search, UsersRound } from "lucide-react";
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
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/matrundan/onboarding-state";
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
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
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
  const contextCopy =
    placeCount === 0
      ? "Börja med att lägga till ett ställe ni vill prova."
      : visitCount === 0
        ? `Ni har redan ${placeCount === 1 ? "ett ställe" : `${placeCount} ställen`} på listan. Välj vad ni vill prova härnäst och registrera besöket efteråt.`
        : "Gruppen är redan igång. Utforska listan och historiken och använd dem när ni väljer nästa upplevelse.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">Så fungerar Matrundan</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Matrundan hjälper gruppen att gå från idéer till gemensamma matminnen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <IntroRow icon={UsersRound} title="Gruppen är utgångspunkten">
            Ställen, planer och historik hör till gruppen ni är inne i.
          </IntroRow>
          <IntroRow icon={Search} title="Samla ställen">
            Lägg till sådant ni är nyfikna på och vill prova tillsammans.
          </IntroRow>
          <IntroRow icon={Flag} title="Välj nästa stopp">
            Använd listan och era tidigare erfarenheter när ni bestämmer vart ni ska härnäst.
          </IntroRow>
          <IntroRow icon={BookOpen} title="Registrera det verkliga besöket">
            Datum och de som faktiskt var med bygger gruppens gemensamma historia.
          </IntroRow>
          <IntroRow icon={History} title="Minns och välj bättre nästa gång">
            Omdömen och besök gör det lättare att hitta tillbaka till det ni gillade.
          </IntroRow>
        </div>

        <Card className="rounded-2xl border-border/70 bg-secondary/25 p-4">
          <div className="text-sm font-medium [overflow-wrap:anywhere]">Just nu i {groupName}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{contextCopy}</p>
        </Card>

        <DialogFooter className={automatic ? "flex-col-reverse gap-2 sm:flex-row" : undefined}>
          {automatic ? (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hoppa över
            </Button>
          ) : null}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {automatic ? "Kom igång" : "Stäng"}
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
