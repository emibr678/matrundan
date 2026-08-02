import { CircleAlert, Info, ShieldQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PlaceDataSignal } from "@/lib/matrundan/place-data-signals";

export function PlaceDataSignalBadge({ signal }: { signal?: PlaceDataSignal }) {
  if (!signal || signal.closureStatus === "none") return null;

  const label =
    signal.closureStatus === "uncertain"
      ? "Uppgifterna är osäkra"
      : signal.closureStatus === "reviewed"
        ? "Kan ha stängt permanent"
        : "Kan ha stängt permanent · ej verifierat";

  return (
    <Badge
      variant="outline"
      className="max-w-full whitespace-normal rounded-full border-amber-500/50 bg-amber-500/10 text-left text-amber-900 dark:text-amber-200"
    >
      <CircleAlert className="mr-1 h-3 w-3 shrink-0" /> {label}
    </Badge>
  );
}

export function PlaceDataSignalNotice({ signal }: { signal?: PlaceDataSignal }) {
  if (!signal) return null;

  if (signal.closureStatus === "uncertain") {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <div className="flex items-start gap-2 font-medium text-amber-950 dark:text-amber-100">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" /> Uppgifterna är osäkra
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Matrundan har fått motstridiga uppgifter om verksamheten. Kontrollera webbplats eller
          karta innan ni planerar ett besök.
        </p>
      </div>
    );
  }

  if (signal.closureStatus === "reviewed" || signal.closureStatus === "unverified") {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <div className="flex items-start gap-2 font-medium text-amber-950 dark:text-amber-100">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Kan ha stängt permanent
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {signal.closureStatus === "reviewed"
            ? "Uppgiften har granskats eller bekräftats från mer än ett oberoende sammanhang. Kontrollera innan ni lägger till stället."
            : "Uppgiften är ännu inte verifierad. Kontrollera webbplats eller karta innan ni lägger till stället."}
        </p>
        {signal.recentlyConfirmedOpen ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Det finns även en nyare indikation på att verksamheten kan vara öppen.
          </p>
        ) : null}
      </div>
    );
  }

  if (signal.limitedInformation) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
        <div className="flex items-start gap-2 font-medium">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> Begränsad
          platsinformation
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Webbplats och öppettider saknas i platsdatan. Det betyder inte att verksamheten har
          stängt, men uppgifterna bör kontrolleras före ett besök.
        </p>
      </div>
    );
  }

  return null;
}
