import * as React from "react";
import {
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  MapPin,
  PencilLine,
  RefreshCw,
} from "lucide-react";

import { usePlacePracticalInfo } from "./PlacePracticalInfoContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { openingHoursDaySummary, openingHoursForDate } from "@/lib/matrundan/opening-hours";
import { placeLocationLabel } from "@/lib/matrundan/place-location-sync";
import { cn } from "@/lib/utils";

function FieldStatus({
  kind,
}: {
  kind: "current" | "group" | "available" | "missing";
}) {
  const content = {
    current: {
      icon: CheckCircle2,
      label: "Stämmer med kartdatan",
      className: "text-muted-foreground",
    },
    group: {
      icon: PencilLine,
      label: "Gruppens egen uppgift",
      className: "text-muted-foreground",
    },
    available: {
      icon: RefreshCw,
      label: "Ny uppgift finns",
      className: "text-mustard-foreground",
    },
    missing: {
      icon: CheckCircle2,
      label: "Ingen uppgift i kartdatan",
      className: "text-muted-foreground",
    },
  }[kind];
  const Icon = content.icon;

  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-medium", content.className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{content.label}</span>
    </div>
  );
}

function ComparisonValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

function InfoSection({
  icon: Icon,
  title,
  status,
  children,
  action,
}: {
  icon: typeof MapPin;
  title: string;
  status: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-background/45 p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="mt-1">{status}</div>
        </div>
      </div>
      <div className="grid gap-2 pl-6">{children}</div>
      {action ? <div className="pl-6">{action}</div> : null}
    </section>
  );
}

function openingHoursSummary(
  schedule: ReturnType<typeof usePlacePracticalInfo>["openingHours"],
  timezone: string | null,
): string {
  if (!schedule) return "Ingen uppgift";
  return openingHoursDaySummary(openingHoursForDate(schedule, new Date(), timezone));
}

export function PlaceLocationRefresh() {
  const {
    effectivePlace,
    practicalInfo,
    details,
    websiteUrl,
    openingHours,
    websiteConflict,
    openingHoursConflict,
    hasExternalSource,
    canEdit,
    canApplyLocation,
    loading,
    refreshing,
    applyingLocation,
    error,
    locationDiff,
    loadExternalDetails,
    applyExternalPracticalInfo,
    applyExternalLocation,
  } = usePlacePracticalInfo();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open || details || loading || error || !hasExternalSource) return;
    void loadExternalDetails(false);
  }, [details, error, hasExternalSource, loadExternalDetails, loading, open]);

  if (!hasExternalSource) return null;

  const hasAttention = Boolean(
    locationDiff?.hasChanges || websiteConflict || openingHoursConflict,
  );
  const currentLocationLabel = placeLocationLabel(effectivePlace) || "Ingen säker adress";
  const externalLocationLabel = details?.location
    ? placeLocationLabel(details.location)
    : "Ingen säker adress i kartdatan";
  const currentWebsiteLabel = websiteUrl ?? "Ingen webbplats för gruppen";
  const externalWebsiteLabel = details?.website ?? "Ingen webbplats i kartdatan";
  const currentOpeningHoursLabel = openingHoursSummary(openingHours, details?.timezone ?? null);
  const externalOpeningHoursLabel = openingHoursSummary(
    details?.openingHours ?? null,
    details?.timezone ?? null,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={
            hasAttention
              ? "Kontrollera uppgifter – nya uppgifter finns"
              : "Kontrollera uppgifter"
          }
          data-testid="place-info-check-trigger"
        >
          <RefreshCw className="h-4 w-4" />
          {hasAttention ? (
            <span
              aria-hidden="true"
              data-testid="place-info-status-dot"
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-mustard ring-2 ring-background"
            />
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 sm:mx-auto sm:max-w-lg"
        data-testid="place-info-check-sheet"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>Kontrollera uppgifter</SheetTitle>
          <SheetDescription>
            Vi jämför gruppens uppgifter med kartdatan. Inget ändras automatiskt.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {loading && !details ? (
            <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-muted/45 px-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Kontrollerar uppgifterna…
            </div>
          ) : null}

          {error ? (
            <p role="status" className="rounded-2xl bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
              {error}
            </p>
          ) : null}

          {details ? (
            <>
              <InfoSection
                icon={MapPin}
                title="Adress och kartposition"
                status={
                  locationDiff?.hasChanges ? (
                    <FieldStatus kind="available" />
                  ) : details.location ? (
                    <FieldStatus kind="current" />
                  ) : (
                    <FieldStatus kind="missing" />
                  )
                }
                action={
                  locationDiff?.hasChanges && details.location ? (
                    canApplyLocation ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11"
                        disabled={applyingLocation}
                        onClick={() => void applyExternalLocation()}
                      >
                        {applyingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Använd ny adress
                      </Button>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        En ägare eller admin kan använda ny adress och kartposition.
                      </p>
                    )
                  ) : undefined
                }
              >
                <ComparisonValue label="I Matrundan" value={currentLocationLabel} />
                <ComparisonValue label="I kartdatan" value={externalLocationLabel} />
              </InfoSection>

              <InfoSection
                icon={Globe2}
                title="Webbplats"
                status={
                  websiteConflict ? (
                    <FieldStatus kind="available" />
                  ) : practicalInfo.websiteOverride ? (
                    <FieldStatus kind="group" />
                  ) : details.website ? (
                    <FieldStatus kind="current" />
                  ) : (
                    <FieldStatus kind="missing" />
                  )
                }
                action={
                  websiteConflict ? (
                    canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-11"
                        onClick={() => void applyExternalPracticalInfo("website")}
                      >
                        Använd kartdatans webbplats
                      </Button>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        En aktiv gruppmedlem kan välja vilken webbplats gruppen ska använda.
                      </p>
                    )
                  ) : undefined
                }
              >
                <ComparisonValue label="Gruppen använder" value={currentWebsiteLabel} />
                <ComparisonValue label="I kartdatan" value={externalWebsiteLabel} />
              </InfoSection>

              <InfoSection
                icon={Clock3}
                title="Öppettider"
                status={
                  openingHoursConflict ? (
                    <FieldStatus kind="available" />
                  ) : practicalInfo.openingHoursOverride ? (
                    <FieldStatus kind="group" />
                  ) : details.openingHours ? (
                    <FieldStatus kind="current" />
                  ) : (
                    <FieldStatus kind="missing" />
                  )
                }
                action={
                  openingHoursConflict ? (
                    canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-11"
                        onClick={() => void applyExternalPracticalInfo("opening_hours")}
                      >
                        Använd kartdatans öppettider
                      </Button>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        En aktiv gruppmedlem kan välja vilka öppettider gruppen ska använda.
                      </p>
                    )
                  ) : undefined
                }
              >
                <ComparisonValue label="Gruppen använder idag" value={currentOpeningHoursLabel} />
                <ComparisonValue label="Kartdatan idag" value={externalOpeningHoursLabel} />
              </InfoSection>
            </>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={refreshing || loading || applyingLocation}
            onClick={() => void loadExternalDetails(true)}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sök igen
          </Button>

          {details?.attribution ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {details.attribution}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
