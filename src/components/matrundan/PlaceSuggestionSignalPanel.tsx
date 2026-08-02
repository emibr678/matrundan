import * as React from "react";
import { CheckCircle2, Loader2, OctagonX } from "lucide-react";
import { toast } from "sonner";

import { PlaceDataSignalNotice } from "./PlaceDataSignalNotice";
import { Button } from "@/components/ui/button";
import {
  confirmPlaceDataSignal,
  type PlaceDataSignal,
  type PlaceDataSignalTarget,
  type PlaceDataSignalVerdict,
} from "@/lib/matrundan/place-data-signals";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

export function PlaceSuggestionSignalPanel({
  signal,
  target,
  disabled = false,
}: {
  signal?: PlaceDataSignal;
  target: PlaceDataSignalTarget;
  disabled?: boolean;
}) {
  const { mode, activeGroupId } = useSession();
  const { state } = useStore();
  const [busyVerdict, setBusyVerdict] = React.useState<PlaceDataSignalVerdict | null>(null);
  const canConfirm =
    mode === "live" &&
    Boolean(activeGroupId) &&
    state.group.lifecycleStatus !== "archived" &&
    signal?.closureStatus !== "none";

  if (!signal || signal.closureStatus === "none") return null;

  async function confirm(verdict: PlaceDataSignalVerdict) {
    if (!activeGroupId || busyVerdict) return;
    setBusyVerdict(verdict);
    try {
      await confirmPlaceDataSignal(activeGroupId, target, verdict);
      window.dispatchEvent(new Event("matrundan:place-data-signals-changed"));
      toast.success(
        verdict === "closed_permanently"
          ? "Tack! Din bekräftelse har sparats."
          : "Tack! Din motuppgift har sparats.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara bekräftelsen.");
    } finally {
      setBusyVerdict(null);
    }
  }

  return (
    <div className="space-y-2">
      <PlaceDataSignalNotice signal={signal} />
      {canConfirm ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 whitespace-normal"
            disabled={disabled || busyVerdict != null}
            onClick={() => void confirm("appears_open")}
          >
            {busyVerdict === "appears_open" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Verkar fortfarande öppet
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 whitespace-normal"
            disabled={disabled || busyVerdict != null}
            onClick={() => void confirm("closed_permanently")}
          >
            {busyVerdict === "closed_permanently" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <OctagonX className="h-4 w-4" />
            )}
            Bekräfta permanent stängt
          </Button>
        </div>
      ) : null}
      {canConfirm ? (
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Din bekräftelse delas anonymt. Grupp, medlem och privata kommentarer visas aldrig.
        </p>
      ) : null}
    </div>
  );
}
