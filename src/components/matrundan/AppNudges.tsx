import * as React from "react";
import { BellRing, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HomeAttentionCard } from "@/components/matrundan/HomeAttentionCard";
import {
  dismissNudge,
  isNudgeHidden,
  muteNudge,
  shouldOfferPermanentNudgeDismissal,
  type NudgeEntry,
  type NudgeKey,
  type NudgeState,
} from "@/lib/matrundan/app-nudge-state";
import { useInstallPrompt } from "@/lib/matrundan/install-prompt";
import {
  checkPushSupport,
  currentDeviceEndpoint,
  enablePushOnThisDevice,
} from "@/lib/matrundan/notifications";
import { useSession } from "@/lib/matrundan/session";

const STORAGE_KEY = "matrundan.nudges.v1";

function readState(): NudgeState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NudgeState) : {};
  } catch {
    return {};
  }
}

function writeState(next: NudgeState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* enhetslokal lagring kan vara blockerad – då visas kortet igen senare */
  }
}

/**
 * Diskreta uppmaningar högst upp på Hem: slå på notiser och lägg appen på
 * hemskärmen. Endast ett kort i taget och alltid möjligt att avfärda.
 */
export function AppNudges() {
  const { mode } = useSession();
  const install = useInstallPrompt();
  const [nudges, setNudges] = React.useState<NudgeState>({});
  const [pushNeeded, setPushNeeded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [dismissChoice, setDismissChoice] = React.useState<NudgeKey | null>(
    null,
  );

  React.useEffect(() => {
    setNudges(readState());
  }, []);

  React.useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    void (async () => {
      if (checkPushSupport().supported !== true) return;
      try {
        const endpoint = await currentDeviceEndpoint();
        if (!cancelled) setPushNeeded(!endpoint);
      } catch {
        /* ignorera – kortet visas då inte */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const update = React.useCallback(
    (key: NudgeKey, value: Partial<NudgeEntry>) => {
      setNudges((current) => {
        const next = { ...current, [key]: { ...current[key], ...value } };
        writeState(next);
        return next;
      });
    },
    [],
  );

  if (mode !== "live") return null;

  const showInstall =
    (install.mode === "prompt" || install.mode === "ios-manual") &&
    !isNudgeHidden(nudges.install);
  const showPush = pushNeeded && !isNudgeHidden(nudges.push);

  // På iPhone måste appen ligga på hemskärmen innan notiser går att slå på.
  const active: NudgeKey | null =
    install.mode === "ios-manual" && showInstall
      ? "install"
      : showPush
        ? "push"
        : showInstall
          ? "install"
          : null;

  if (!active) return null;

  function dismiss(key: NudgeKey) {
    if (shouldOfferPermanentNudgeDismissal(nudges[key])) {
      setDismissChoice(key);
      return;
    }
    update(key, dismissNudge(nudges[key]));
  }

  function remindLater() {
    if (!dismissChoice) return;
    update(dismissChoice, dismissNudge(nudges[dismissChoice]));
    setDismissChoice(null);
  }

  function stopReminding() {
    if (!dismissChoice) return;
    update(dismissChoice, muteNudge(nudges[dismissChoice]));
    setDismissChoice(null);
  }

  async function turnOnPush() {
    setBusy(true);
    try {
      const result = await enablePushOnThisDevice();
      if (result.status === "enabled") {
        toast.success("Notiser är påslagna på den här enheten.");
        setPushNeeded(false);
        update("push", { done: true });
      } else if (result.status === "denied") {
        toast.error(
          "Notiser är blockerade i webbläsarens inställningar för Matrundan.",
        );
        update("push", { done: true });
      } else {
        toast.error(result.message);
        update("push", { dismissedAt: Date.now() });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte slå på notiser.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addToHomeScreen() {
    setBusy(true);
    try {
      const outcome = await install.promptInstall();
      if (outcome === "accepted") update("install", { done: true });
    } catch {
      toast.error("Kunde inte öppna installationen.");
    } finally {
      setBusy(false);
    }
  }

  const nudgeCard =
    active === "push" ? (
      <HomeAttentionCard
        icon={BellRing}
        title="Slå på notiser"
        description="Få veta när gruppen registrerar ett besök eller väljer nästa stopp."
        actions={
          <>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void turnOnPush()}
            >
              Slå på notiser
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => dismiss("push")}
            >
              Inte nu
            </Button>
          </>
        }
      />
    ) : (
      <HomeAttentionCard
        icon={Smartphone}
        title="Lägg Matrundan på hemskärmen"
        description={
          install.mode === "prompt" ? (
            "Då öppnas Matrundan som en egen app, utan adressfält."
          ) : (
            <>
              Tryck på <Share className="inline h-4 w-4" aria-hidden /> Dela i
              Safari och välj{" "}
              <span className="font-medium text-foreground">
                Lägg till på hemskärmen
              </span>
              . Det krävs på iPhone och iPad innan notiser går att slå på.
            </>
          )
        }
        actions={
          install.mode === "prompt" ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void addToHomeScreen()}
              >
                Lägg till på hemskärmen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => dismiss("install")}
              >
                Inte nu
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => dismiss("install")}
            >
              Inte nu
            </Button>
          )
        }
      />
    );

  const dismissDescription =
    dismissChoice === "push"
      ? "Du kan bli påmind igen om 30 dagar eller sluta visa den här påminnelsen på den här enheten. Notiser kan fortfarande slås på i Min profil."
      : "Du kan bli påmind igen om 30 dagar eller sluta visa den här påminnelsen på den här enheten. Matrundan kan fortfarande läggas på hemskärmen via Min profil.";

  return (
    <>
      {nudgeCard}
      <AlertDialog
        open={dismissChoice !== null}
        onOpenChange={(open) => {
          if (!open) setDismissChoice(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vill du få påminnelsen igen?</AlertDialogTitle>
            <AlertDialogDescription>
              {dismissDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={remindLater}>
              Påminn om 30 dagar
            </AlertDialogCancel>
            <AlertDialogAction onClick={stopReminding}>
              Visa inte igen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Permanent hjälpavsnitt i profilen för den som avfärdat kortet. */
export function InstallAppSection() {
  const install = useInstallPrompt();
  const [busy, setBusy] = React.useState(false);

  if (install.mode === "none") return null;

  return (
    <Card className="rounded-2xl border-border/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="h-4 w-4 text-primary" />
        Appen på mobilen
      </div>
      {install.mode === "installed" ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Matrundan körs redan som app på den här enheten.
        </p>
      ) : install.mode === "prompt" ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Lägg Matrundan på hemskärmen så öppnas den som en egen app.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void install.promptInstall().finally(() => setBusy(false));
            }}
          >
            Lägg till på hemskärmen
          </Button>
        </>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Tryck på Dela längst ned i Safari och välj Lägg till på hemskärmen. På
          iPhone och iPad krävs det innan notiser går att slå på.
        </p>
      )}
    </Card>
  );
}
