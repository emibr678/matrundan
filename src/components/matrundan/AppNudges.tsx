import * as React from "react";
import { BellRing, Share, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useInstallPrompt } from "@/lib/matrundan/install-prompt";
import {
  checkPushSupport,
  currentDeviceEndpoint,
  enablePushOnThisDevice,
} from "@/lib/matrundan/notifications";
import { useSession } from "@/lib/matrundan/session";

const STORAGE_KEY = "matrundan.nudges.v1";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

type NudgeKey = "push" | "install";
type NudgeState = Partial<Record<NudgeKey, { dismissedAt?: number; done?: boolean }>>;

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

function isHidden(state: NudgeState, key: NudgeKey): boolean {
  const entry = state[key];
  if (!entry) return false;
  if (entry.done) return true;
  if (entry.dismissedAt && Date.now() - entry.dismissedAt < SNOOZE_MS) return true;
  return false;
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

  const update = React.useCallback((key: NudgeKey, value: NudgeState[NudgeKey]) => {
    setNudges((current) => {
      const next = { ...current, [key]: { ...current[key], ...value } };
      writeState(next);
      return next;
    });
  }, []);

  if (mode !== "live") return null;

  const showInstall =
    (install.mode === "prompt" || install.mode === "ios-manual") && !isHidden(nudges, "install");
  const showPush = pushNeeded && !isHidden(nudges, "push");

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

  async function turnOnPush() {
    setBusy(true);
    try {
      const result = await enablePushOnThisDevice();
      if (result.status === "enabled") {
        toast.success("Notiser är påslagna på den här enheten.");
        setPushNeeded(false);
        update("push", { done: true });
      } else if (result.status === "denied") {
        toast.error("Notiser är blockerade i webbläsarens inställningar för Matrundan.");
        update("push", { done: true });
      } else {
        toast.error(result.message);
        update("push", { dismissedAt: Date.now() });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte slå på notiser.");
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

  return (
    <Card className="relative rounded-2xl border-border/70 bg-card/80 p-4">
      <button
        type="button"
        aria-label="Dölj tipset"
        onClick={() => update(active, { dismissedAt: Date.now() })}
        className="absolute top-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>

      {active === "push" ? (
        <div className="pr-8">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="h-4 w-4 text-primary" />
            Slå på notiser
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Få veta när gruppen registrerar ett besök eller väljer nästa stopp. Du väljer själv
            vilka notiser du vill ha under Min profil.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void turnOnPush()}>
              Slå på notiser
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => update("push", { dismissedAt: Date.now() })}
            >
              Inte nu
            </Button>
          </div>
        </div>
      ) : (
        <div className="pr-8">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="h-4 w-4 text-primary" />
            Lägg Matrundan på hemskärmen
          </div>
          {install.mode === "prompt" ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Då öppnas Matrundan som en egen app, utan adressfält.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void addToHomeScreen()}>
                  Lägg till på hemskärmen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => update("install", { dismissedAt: Date.now() })}
                >
                  Inte nu
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-sm leading-relaxed text-muted-foreground">
                <span>Tryck på</span>
                <Share className="h-4 w-4" aria-hidden />
                <span>Dela längst ned i Safari och välj</span>
                <span className="font-medium text-foreground">Lägg till på hemskärmen</span>.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                På iPhone och iPad krävs det innan notiser går att slå på.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => update("install", { dismissedAt: Date.now() })}
                >
                  Jag fixar det senare
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
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
          Tryck på Dela längst ned i Safari och välj Lägg till på hemskärmen. På iPhone och iPad
          krävs det innan notiser går att slå på.
        </p>
      )}
    </Card>
  );
}
