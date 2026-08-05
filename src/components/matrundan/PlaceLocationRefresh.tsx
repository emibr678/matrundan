import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PlaceDataReportDialog } from "./PlaceDataReportDialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  applyGeoapifyPlaceLocation,
  geoapifyPlaceDetails,
  type PlaceExternalDetails,
} from "@/lib/matrundan/geoapify-place-details.functions";
import { comparePlaceLocation, placeLocationLabel } from "@/lib/matrundan/place-location-sync";
import { isCredibleStreetAddress } from "@/lib/matrundan/place-links";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Place } from "@/lib/matrundan/types";

export function PlaceLocationRefresh({
  place,
  groupId,
  canReport,
}: {
  place: Place;
  groupId: string;
  canReport: boolean;
}) {
  const { mode, exampleMode } = useSession();
  const { state, demoReadOnly } = useStore();
  const [open, setOpen] = React.useState(false);
  const [details, setDetails] = React.useState<PlaceExternalDetails | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasGeoapifySource = (place.sources ?? []).some(
    (source) => source.provider === "geoapify" && source.status === "active",
  );
  const currentMember = state.members.find((member) => member.id === state.currentUserId);
  const canApply =
    !demoReadOnly &&
    canReport &&
    (currentMember?.role === "ägare" || currentMember?.role === "admin");
  const locationDiff = comparePlaceLocation(place, details?.location);

  const load = React.useCallback(
    async (forceRefresh: boolean) => {
      if (!canReport || mode !== "live" || exampleMode || !hasGeoapifySource) return;
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setApplied(false);
      try {
        const next = await geoapifyPlaceDetails({
          data: { groupId, placeId: place.id, forceRefresh },
        });
        setDetails(next);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Kartdatan kunde inte hämtas.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canReport, exampleMode, groupId, hasGeoapifySource, mode, place.id],
  );

  React.useEffect(() => {
    if (!open || details || loading || error) return;
    void load(false);
  }, [details, error, load, loading, open]);

  async function applyLocation() {
    if (!canApply || applying) return;
    setApplying(true);
    setError(null);
    try {
      const result = await applyGeoapifyPlaceLocation({
        data: { groupId, placeId: place.id },
      });
      setApplied(true);
      toast.success("Adressen och kartpositionen är uppdaterade.", {
        description: result.sourceLinked
          ? "Stället är också kopplat till sin OpenStreetMap-källa."
          : "Gruppens webbplats och öppettider är oförändrade.",
      });
      window.dispatchEvent(new Event("matrundan:reload"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kartdatan kunde inte användas.");
    } finally {
      setApplying(false);
    }
  }

  if (!canReport || mode !== "live" || exampleMode || !hasGeoapifySource) return null;

  const currentLocationLabel = isCredibleStreetAddress(place.address, place.name)
    ? placeLocationLabel(place)
    : "Ingen säker adress";
  const externalLocationLabel = details?.location ? placeLocationLabel(details.location) : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Kontrollera adress och kartposition"
          data-testid="place-location-refresh-trigger"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl"
        data-testid="place-location-refresh"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Adress och kartposition</SheetTitle>
          <SheetDescription>
            Inget ändras automatiskt. Jämför uppgifterna innan du väljer.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Kontrollerar kartdatan…
            </div>
          ) : null}

          {details && !loading ? (
            <>
              {applied ? (
                <div className="rounded-xl bg-sage/20 px-3 py-2 text-sm">
                  Den nya adressen har använts. Sidan uppdateras med aktuell platsdata.
                </div>
              ) : locationDiff?.hasChanges && details.location && externalLocationLabel ? (
                <section className="space-y-3 rounded-xl border border-border/70 bg-background/45 p-3">
                  <h3 className="text-sm font-medium">Ny adress hittad</h3>
                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">I Matrundan</dt>
                      <dd className="mt-0.5 [overflow-wrap:anywhere]">{currentLocationLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">I kartdatan</dt>
                      <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">
                        {externalLocationLabel}
                      </dd>
                    </div>
                  </dl>
                  {locationDiff.positionChanged ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Kartpositionen uppdateras samtidigt så att sökning och kartlänkar leder rätt.
                    </p>
                  ) : null}
                  <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
                    {canApply ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11"
                        disabled={applying}
                        onClick={() => void applyLocation()}
                      >
                        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Använd ny adress
                      </Button>
                    ) : (
                      <p className="py-2 text-xs leading-relaxed text-muted-foreground">
                        En ägare eller admin kan använda den nya adressen.
                      </p>
                    )}
                    <PlaceDataReportDialog
                      place={place}
                      compact
                      initialCategory="wrong_address"
                      triggerLabel="Kartdatan stämmer inte"
                    />
                  </div>
                </section>
              ) : details.location ? (
                <p className="rounded-xl bg-background/45 px-3 py-2 text-sm text-muted-foreground">
                  Adress och kartposition stämmer med den senast hittade kartdatan.
                </p>
              ) : (
                <div className="space-y-2 rounded-xl bg-background/45 px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    Ingen säker adress hittades i kartdatan.
                  </p>
                  <PlaceDataReportDialog
                    place={place}
                    compact
                    initialCategory="wrong_address"
                    triggerLabel="Rapportera adress eller position"
                  />
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={refreshing || applying}
                onClick={() => void load(true)}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sök igen
              </Button>
            </>
          ) : null}

          {error ? (
            <p role="status" className="text-xs leading-relaxed text-muted-foreground">
              {error}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
