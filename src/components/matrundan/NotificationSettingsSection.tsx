import * as React from "react";
import { BellRing, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_LABELS,
  NOTIFICATION_TYPES,
  checkPushSupport,
  currentDeviceEndpoint,
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  isIosLike,
  loadNotificationSettings,
  removeNotificationDevice,
  saveNotificationPreference,
  type NotificationDevice,
  type NotificationType,
} from "@/lib/matrundan/notifications";

/**
 * Notisinställningar för det inloggade kontot: en prenumeration per enhet
 * och ett val per notistyp som gäller alla enheter.
 */
export function NotificationSettingsSection({ active }: { active: boolean }) {
  const [preferences, setPreferences] = React.useState<Record<string, boolean>>({});
  const [devices, setDevices] = React.useState<NotificationDevice[]>([]);
  const [thisEndpoint, setThisEndpoint] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const support = React.useMemo(() => (active ? checkPushSupport() : null), [active]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, endpoint] = await Promise.all([
        loadNotificationSettings(),
        currentDeviceEndpoint(),
      ]);
      setPreferences(settings.preferences);
      setDevices(settings.devices);
      setThisEndpoint(endpoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte hämta notisinställningarna.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  const enabledHere = Boolean(thisEndpoint && devices.some((d) => d.endpoint === thisEndpoint));

  async function toggleDevice(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const result = await enablePushOnThisDevice();
        if (result.status === "denied") {
          toast.error("Notiser är blockerade i webbläsarens inställningar för Matrundan.");
        } else if (result.status === "unavailable") {
          toast.error(result.message);
        } else {
          toast.success("Notiser är påslagna på den här enheten.");
        }
      } else {
        await disablePushOnThisDevice();
        toast.success("Notiser är avstängda på den här enheten.");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte ändra notiser på enheten.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePreference(type: NotificationType, next: boolean) {
    const previous = preferences;
    setPreferences({ ...preferences, [type]: next });
    try {
      await saveNotificationPreference(type, next);
    } catch (err) {
      setPreferences(previous);
      toast.error(err instanceof Error ? err.message : "Kunde inte spara valet.");
    }
  }

  async function forgetDevice(device: NotificationDevice) {
    try {
      await removeNotificationDevice(device.id);
      if (device.endpoint === thisEndpoint) await disablePushOnThisDevice().catch(() => {});
      toast.success("Enheten är borttagen.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte ta bort enheten.");
    }
  }

  return (
    <Card className="rounded-2xl border-border/70 p-4">
      <div className="flex items-start gap-2">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="text-sm font-medium">Notiser</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Få en diskret påminnelse när något händer i dina grupper.
          </p>
        </div>
      </div>

      {support && !support.supported ? (
        <p className="mt-3 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          {support.reason === "ios-needs-install"
            ? "På iPhone och iPad fungerar notiser först när du lagt till Matrundan på hemskärmen: tryck på Dela och välj ”Lägg till på hemskärmen”. Öppna sedan appen därifrån."
            : isIosLike()
              ? "Den här webbläsaren stöder inte notiser."
              : "Den här webbläsaren stöder inte notiser. Prova Chrome, Edge eller Safari."}
        </p>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
          <div className="min-w-0">
            <div className="text-sm">Notiser på den här enheten</div>
            <p className="text-xs text-muted-foreground">
              {enabledHere ? "Påslagna" : "Avstängda"}
            </p>
          </div>
          <Switch
            checked={enabledHere}
            disabled={busy || loading}
            onCheckedChange={(next) => void toggleDevice(next)}
            aria-label="Notiser på den här enheten"
          />
        </div>
      )}

      {error ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            Försök igen
          </Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vad vill du få notis om?
        </div>
        {NOTIFICATION_TYPES.map((type) => (
          <div key={type} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm">{NOTIFICATION_LABELS[type].title}</div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {NOTIFICATION_LABELS[type].hint}
              </p>
            </div>
            <Switch
              checked={preferences[type] ?? true}
              disabled={loading}
              onCheckedChange={(next) => void togglePreference(type, next)}
              aria-label={NOTIFICATION_LABELS[type].title}
            />
          </div>
        ))}
      </div>

      {devices.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dina enheter
          </div>
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/70 p-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  {device.device_label ?? "Enhet"}
                  {device.endpoint === thisEndpoint ? " (den här)" : ""}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Ta bort ${device.device_label ?? "enhet"}`}
                onClick={() => void forgetDevice(device)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
