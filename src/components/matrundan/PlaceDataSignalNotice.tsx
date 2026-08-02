import { CircleAlert, HelpCircle, Info, ShieldQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlaceDataSignal } from "@/lib/matrundan/place-data-signals";

export function PlaceDataSignalBadge({ signal }: { signal?: PlaceDataSignal }) {
  if (!signal || signal.closureStatus === "none") return null;

  const label =
    signal.closureStatus === "uncertain"
      ? "Uppgifterna är osäkra"
      : signal.closureStatus === "reviewed"
        ? "Kan ha stängt permanent"
        : "Kan ha stängt permanent · ej bekräftat";

  return (
    <Badge
      variant="outline"
      className="max-w-full whitespace-normal rounded-full border-amber-500/50 bg-amber-500/10 text-left text-amber-900 dark:text-amber-200"
    >
      <CircleAlert className="mr-1 h-3 w-3 shrink-0" /> {label}
    </Badge>
  );
}

export function PlaceDataLimitedInfoIndicator({ signal }: { signal?: PlaceDataSignal }) {
  if (!signal?.limitedInformation || signal.closureStatus !== "none") return null;

  return (
    <span
      className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground"
      title="Begränsad platsinformation"
      aria-label="Begränsad platsinformation"
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

export function PlaceDataLimitedInfoNotice({ signal }: { signal?: PlaceDataSignal }) {
  if (!signal?.limitedInformation || signal.closureStatus !== "none") return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 py-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          aria-label="Begränsad platsinformation"
        >
          <Info className="h-3.5 w-3.5 shrink-0" />
          Begränsad platsinformation
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(18rem,calc(100vw-2rem))] text-xs leading-relaxed">
        Webbplats och öppettider saknas i kartdatan. Det säger inget om huruvida stället är öppet
        – kontrollera gärna Google Maps före besöket.
      </PopoverContent>
    </Popover>
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
            ? "Uppgiften har granskats eller fått stöd från mer än ett oberoende sammanhang. Kontrollera innan ni lägger till stället."
            : "Någon har rapporterat att stället kan ha stängt. Uppgiften är inte bekräftad – kontrollera innan ni planerar ett besök."}
        </p>
        {signal.recentlyConfirmedOpen ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Det finns även en nyare indikation på att verksamheten kan vara öppen.
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}
