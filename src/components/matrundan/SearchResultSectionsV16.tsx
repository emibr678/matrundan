import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Clock3, Globe2, Link2, MapPin, Plus } from "lucide-react";
import { OwnPlaceSuggestionReportBadge, PlaceDataSignalBadge } from "./PlaceDataSignalNotice";
import { PlaceExternalLink } from "./PlaceExternalLink";
import { PlaceIdentityMark } from "./PlaceIdentityMark";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { matchingPlace } from "@/lib/matrundan/add-place-v16-utils";
import type { ManualSourceMatchReason } from "@/lib/matrundan/manual-place-source-linking";
import { MANUAL_SOURCE_MATCH_REASON_LABEL } from "@/lib/matrundan/manual-place-source-linking";
import { normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import { placeSignalKey, type PlaceDataSignal } from "@/lib/matrundan/place-data-signals";
import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { useOwnOpenPlaceSuggestionReportKeys } from "@/lib/matrundan/use-own-place-suggestion-reports";
import { usePlaceDataSignalsForSuggestions } from "@/lib/matrundan/use-place-data-signals";
import { CATEGORY_LABEL, type Place } from "@/lib/matrundan/types";

export interface SourceMatchResult {
  result: PlaceSuggestion;
  place: Place;
  reason: ManualSourceMatchReason;
}

export function SearchResultSectionsV16({
  available,
  sourceMatches,
  existing,
  existingOpen,
  onExistingOpenChange,
  selectedId,
  selectedResultIds,
  bulkMode,
  onSelect,
  onToggleSelected,
  onAdd,
  onLinkSource,
  places,
  disabled,
}: {
  available: PlaceSuggestion[];
  sourceMatches: SourceMatchResult[];
  existing: PlaceSuggestion[];
  existingOpen: boolean;
  onExistingOpenChange: (open: boolean) => void;
  selectedId: string | null;
  selectedResultIds: Set<string>;
  bulkMode: boolean;
  onSelect: (id: string) => void;
  onToggleSelected: (result: PlaceSuggestion) => void;
  onAdd: (result: PlaceSuggestion) => void;
  onLinkSource: (match: SourceMatchResult) => void;
  places: Place[];
  disabled: boolean;
}) {
  const signalSuggestions = React.useMemo(() => {
    const seen = new Set<string>();
    return [...sourceMatches.map((match) => match.result), ...available, ...existing].filter(
      (suggestion) => {
        const key = placeSignalKey({
          provider: suggestion.provider,
          providerPlaceId: suggestion.externalId,
        });
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      },
    );
  }, [available, existing, sourceMatches]);
  const signals = usePlaceDataSignalsForSuggestions(signalSuggestions);
  const ownOpenReportKeys = useOwnOpenPlaceSuggestionReportKeys();
  const signalFor = React.useCallback(
    (suggestion: PlaceSuggestion) =>
      signals[
        placeSignalKey({
          provider: suggestion.provider,
          providerPlaceId: suggestion.externalId,
        })
      ],
    [signals],
  );
  const hasOwnOpenReport = React.useCallback(
    (suggestion: PlaceSuggestion) =>
      ownOpenReportKeys.has(
        placeSignalKey({
          provider: suggestion.provider,
          providerPlaceId: suggestion.externalId,
        }),
      ),
    [ownOpenReportKeys],
  );
  const statusFooterFor = React.useCallback(
    (suggestion: PlaceSuggestion, signal?: PlaceDataSignal): React.ReactNode | undefined => {
      const ownReportOpen = hasOwnOpenReport(suggestion);
      if ((!signal || signal.closureStatus === "none") && !ownReportOpen) return undefined;
      return (
        <div className="space-y-1.5">
          {signal?.closureStatus !== "none" ? <PlaceDataSignalBadge signal={signal} /> : null}
          <OwnPlaceSuggestionReportBadge active={ownReportOpen} />
        </div>
      );
    },
    [hasOwnOpenReport],
  );

  return (
    <div className="space-y-4">
      {sourceMatches.length > 0 ? (
        <section aria-label="Möjliga matchningar i gruppen" className="space-y-2">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Möjlig match i gruppen</p>
            <p className="mt-1">
              Granska innan den externa källan länkas. Befintliga besök, omdömen och gruppuppgifter
              ligger kvar på samma matställe.
            </p>
          </div>
          {sourceMatches.map((match) => {
            const signal = signalFor(match.result);
            const statusFooter = statusFooterFor(match.result, signal);
            return (
              <SuggestionRowV16
                key={match.result.externalId}
                result={match.result}
                signal={signal}
                selected={selectedId === match.result.externalId}
                bulkSelected={false}
                bulkMode={false}
                interactionLabel={`Visa möjlig matchning för ${match.result.name}`}
                onSelect={() => onSelect(match.result.externalId)}
                footer={
                  <div className="space-y-2">
                    <span className="block text-[11px] text-muted-foreground">
                      Matchar {match.place.name}: {MANUAL_SOURCE_MATCH_REASON_LABEL[match.reason]}
                    </span>
                    {statusFooter}
                  </div>
                }
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    disabled={disabled}
                    onClick={() => onLinkSource(match)}
                  >
                    <Link2 className="h-4 w-4" /> Granska länk
                  </Button>
                }
              />
            );
          })}
        </section>
      ) : null}

      <section className="space-y-2">
        {available.length > 0 ? (
          available.map((result) => {
            const bulkSelected = selectedResultIds.has(result.externalId);
            const signal = signalFor(result);
            return (
              <SuggestionRowV16
                key={result.externalId}
                result={result}
                signal={signal}
                selected={!bulkMode && selectedId === result.externalId}
                bulkSelected={bulkSelected}
                bulkMode={bulkMode}
                interactionLabel={
                  bulkMode
                    ? `${bulkSelected ? "Avmarkera" : "Välj"} ${result.name} för masstillägg`
                    : `Visa information om ${result.name}`
                }
                onSelect={() => {
                  onSelect(result.externalId);
                  if (bulkMode) onToggleSelected(result);
                  else onAdd(result);
                }}
                footer={statusFooterFor(result, signal)}
                action={
                  bulkMode ? (
                    <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-muted/70">
                      <Checkbox
                        checked={bulkSelected}
                        onCheckedChange={() => onToggleSelected(result)}
                        disabled={disabled}
                        aria-label={`Välj ${result.name} för masstillägg`}
                      />
                    </label>
                  ) : (
                    <Button
                      size="sm"
                      className="min-h-11 w-full shrink-0 sm:w-auto"
                      disabled={disabled}
                      onClick={() => onAdd(result)}
                    >
                      <Plus className="h-4 w-4" /> Lägg till
                    </Button>
                  )
                }
              />
            );
          })
        ) : sourceMatches.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Inga nya ställen i den här sökningen.
          </p>
        ) : null}
      </section>

      {existing.length > 0 ? (
        <Collapsible open={existingOpen} onOpenChange={onExistingOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-left text-sm font-medium"
            >
              <span>Redan i gruppen ({existing.length})</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${existingOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {existing.map((result) => {
              const place = matchingPlace(places, result);
              const signal = signalFor(result);
              return (
                <SuggestionRowV16
                  key={result.externalId}
                  result={result}
                  signal={signal}
                  selected={selectedId === result.externalId}
                  bulkSelected={false}
                  bulkMode={false}
                  onSelect={() => onSelect(result.externalId)}
                  footer={statusFooterFor(result, signal)}
                  action={
                    place ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                      >
                        <Link to="/matstallen/$placeId" params={{ placeId: place.id }}>
                          Öppna
                        </Link>
                      </Button>
                    ) : (
                      <span className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-4 w-4" /> Tillagd
                      </span>
                    )
                  }
                />
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function SuggestionRowV16({
  result,
  signal,
  selected,
  bulkSelected,
  bulkMode,
  interactionLabel,
  onSelect,
  action,
  footer,
}: {
  result: PlaceSuggestion;
  signal?: PlaceDataSignal;
  selected: boolean;
  bulkSelected: boolean;
  bulkMode: boolean;
  interactionLabel?: string;
  onSelect: () => void;
  action: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const websiteUrl = normalizeWebsiteUrl(result.website);
  const hasPracticalInfo = Boolean(websiteUrl || result.hasOpeningHours);

  return (
    <div
      className={`grid min-w-0 gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        selected || bulkSelected ? "border-primary/60 bg-primary/5" : "border-border/70"
      }`}
      data-slot="place-suggestion-card"
      data-bulk-selected={bulkSelected}
      data-closure-status={signal?.closureStatus ?? "none"}
    >
      <div className="min-w-0">
        <button
          type="button"
          className="flex w-full min-w-0 items-start gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onSelect}
          aria-label={interactionLabel}
          aria-pressed={bulkMode ? bulkSelected : selected}
        >
          <PlaceIdentityMark category={result.category} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block break-words font-display text-base font-semibold leading-tight">
              {result.name}
            </span>
            <span className="mt-0.5 block break-words text-xs text-muted-foreground">
              {CATEGORY_LABEL[result.category]}
              {result.cuisines?.length ? ` · ${result.cuisines.slice(0, 3).join(", ")}` : ""}
            </span>
            <span className="mt-1 flex min-w-0 items-start gap-1 text-[11px] leading-relaxed text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">
                {result.area ? `${result.area} · ` : ""}
                {result.city}
                {result.distanceKm != null
                  ? ` · ~${result.distanceKm} km${
                      result.nearestAreaLabel ? ` från ${result.nearestAreaLabel}` : ""
                    }`
                  : ""}
              </span>
            </span>
            {result.address ? (
              <span className="mt-0.5 block break-words pl-4 text-[11px] leading-relaxed text-muted-foreground">
                {result.address}
              </span>
            ) : null}
          </span>
        </button>

        {hasPracticalInfo ? (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 border-t border-border/60 pt-1">
            {websiteUrl ? (
              <PlaceExternalLink
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                icon={Globe2}
                tail="Webbplats"
                className="min-h-11 px-1 text-xs"
                aria-label={`Öppna webbplatsen för ${result.name}`}
              />
            ) : null}
            {result.hasOpeningHours ? (
              <span className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />
                Öppettider finns
              </span>
            ) : null}
          </div>
        ) : null}

        {footer ? <div className="mt-2 break-words">{footer}</div> : null}
      </div>

      <div className={bulkMode ? "justify-self-end" : "w-full sm:w-auto"}>{action}</div>
    </div>
  );
}
