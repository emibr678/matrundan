import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { CrossGroupPracticalInfoSuggestions } from "./CrossGroupPracticalInfoSuggestions";
import { PlacePracticalInfoDialog } from "./PlacePracticalInfoDialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  geoapifyPlaceDetails,
  type PlaceExternalDetails,
} from "@/lib/matrundan/geoapify-place-details.functions";
import {
  openingHoursDaySummary,
  openingHoursForDate,
  type OpeningHoursSchedule,
} from "@/lib/matrundan/opening-hours";
import { normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import {
  emptyGroupPlacePracticalInfo,
  getGroupPlacePracticalInfo,
  getLocalGroupPlacePracticalInfo,
  updateGroupPlacePracticalInfo,
  updateLocalGroupPlacePracticalInfo,
  type GroupPlacePracticalInfo,
} from "@/lib/matrundan/practical-info";
import { useSession } from "@/lib/matrundan/session";
import { googleMapsUrl, useStore } from "@/lib/matrundan/store";
import type { Place } from "@/lib/matrundan/types";

const CACHE_PREFIX = "matrundan.place-external-info.v2";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  cachedAt: string;
  details: PlaceExternalDetails;
}

function cacheKey(place: Place): string | null {
  const source = (place.sources ?? []).find(
    (candidate) => candidate.provider === "geoapify" && candidate.status === "active",
  );
  return source ? `${CACHE_PREFIX}.${source.providerPlaceId}` : null;
}

function readCache(key: string): PlaceExternalDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) ?? "null") as CacheEntry | null;
    if (!parsed?.cachedAt || !parsed.details?.fetchedAt) return null;
    if (Date.now() - new Date(parsed.cachedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    return parsed.details;
  } catch {
    return null;
  }
}

function writeCache(key: string, details: PlaceExternalDetails): void {
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ cachedAt: new Date().toISOString(), details } satisfies CacheEntry),
    );
  } catch {
    /* Cache är en optimering, aldrig ett krav för flödet. */
  }
}

function formattedFetchedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function scheduleEqual(
  left: OpeningHoursSchedule | null,
  right: OpeningHoursSchedule | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function OpeningHoursDetails({
  schedule,
  timezone,
  groupOverride,
}: {
  schedule: OpeningHoursSchedule;
  timezone: string | null;
  groupOverride: boolean;
}) {
  const today = openingHoursForDate(schedule, new Date(), timezone);
  const todaySummary = openingHoursDaySummary(today);

  return (
    <details className="group rounded-xl border border-border/60 bg-background/55">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm marker:content-none">
        <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Öppettider idag</span>
          <span className="ml-1.5 text-muted-foreground">{todaySummary}</span>
        </span>
        {groupOverride ? (
          <Badge variant="secondary" className="hidden shrink-0 rounded-full sm:inline-flex">
            Gruppens uppgift
          </Badge>
        ) : null}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/60 px-3 py-2.5">
        <dl className="space-y-1.5 text-sm">
          {schedule.days.map((day) => (
            <div key={day.code} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <dt className={day.code === today.code ? "font-medium" : "text-muted-foreground"}>
                {day.label}
              </dt>
              <dd className="max-w-[11rem] text-right [overflow-wrap:anywhere]">
                {openingHoursDaySummary(day)}
              </dd>
            </div>
          ))}
        </dl>
        {schedule.partiallyParsed ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Specialdagar eller ovanliga regler kan avvika. Kontrollera gärna verksamhetens egen
            information före besöket.
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function PlaceExternalInfo({
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
  const key = React.useMemo(() => cacheKey(place), [place]);
  const [details, setDetails] = React.useState<PlaceExternalDetails | null>(() =>
    key ? readCache(key) : null,
  );
  const [practicalInfo, setPracticalInfo] = React.useState<GroupPlacePracticalInfo>(
    emptyGroupPlacePracticalInfo,
  );
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [practicalInfoError, setPracticalInfoError] = React.useState<string | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const storageKind = exampleMode ? "session" : "local";
  const actor = state.members.find((member) => member.id === state.currentUserId);

  const loadPracticalInfo = React.useCallback(async () => {
    try {
      const next =
        mode === "live"
          ? await getGroupPlacePracticalInfo(groupId, place.id)
          : getLocalGroupPlacePracticalInfo(groupId, place.id, storageKind);
      setPracticalInfo(next);
      setPracticalInfoError(null);
    } catch (caught) {
      setPracticalInfo(emptyGroupPlacePracticalInfo());
      setPracticalInfoError(
        caught instanceof Error
          ? caught.message
          : "Gruppens praktiska information kunde inte hämtas.",
      );
    }
  }, [groupId, mode, place.id, storageKind]);

  React.useEffect(() => {
    void loadPracticalInfo();
    const changed = () => void loadPracticalInfo();
    window.addEventListener("matrundan:practical-info-changed", changed);
    return () => window.removeEventListener("matrundan:practical-info-changed", changed);
  }, [loadPracticalInfo]);

  React.useEffect(() => {
    setDetails(key ? readCache(key) : null);
    setLoading(false);
    setError(null);
  }, [key]);

  const loadExternalDetails = React.useCallback(
    async (forceRefresh = false) => {
      if (mode !== "live" || exampleMode || !key) return;
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const nextDetails = await geoapifyPlaceDetails({
          data: { groupId, placeId: place.id, forceRefresh },
        });
        setDetails(nextDetails);
        writeCache(key, nextDetails);
        if (forceRefresh) {
          toast.success("Senaste kartdatan är hämtad.");
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Platsinformationen kunde inte hämtas.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [exampleMode, groupId, key, mode, place.id],
  );

  React.useEffect(() => {
    if (mode !== "live" || exampleMode || !key || details) return;
    void loadExternalDetails(false);
  }, [details, exampleMode, key, loadExternalDetails, mode]);

  const canonicalOrStoredWebsite = normalizeWebsiteUrl(place.website) ?? details?.website ?? null;
  const websiteUrl = practicalInfo.websiteOverride ?? canonicalOrStoredWebsite;
  const openingHours = practicalInfo.openingHoursOverride ?? details?.openingHours ?? null;
  const websiteConflict = Boolean(
    practicalInfo.websiteOverride &&
    details?.website &&
    practicalInfo.websiteOverride !== details.website,
  );
  const openingHoursConflict = Boolean(
    practicalInfo.openingHoursOverride &&
    details?.openingHours &&
    !scheduleEqual(practicalInfo.openingHoursOverride, details.openingHours),
  );
  const hasConflict = websiteConflict || openingHoursConflict;
  const hasGeoapifySource = Boolean(key);
  const fetchedLabel = details ? formattedFetchedAt(details.fetchedAt) : "";
  const canEdit = canReport && !demoReadOnly && !practicalInfoError;

  async function applyMapDataForConflicts() {
    if (!actor) return;
    const nextInput = {
      websiteOverride: websiteConflict ? null : practicalInfo.websiteOverride,
      openingHoursOverride: openingHoursConflict ? null : practicalInfo.openingHoursOverride,
      sourceUrl: websiteConflict && openingHoursConflict ? null : practicalInfo.sourceUrl,
      sourceNote: websiteConflict && openingHoursConflict ? null : practicalInfo.sourceNote,
    };
    try {
      let next: GroupPlacePracticalInfo;
      if (mode === "live") {
        await updateGroupPlacePracticalInfo(groupId, place.id, nextInput);
        next = {
          ...nextInput,
          updatedBy: actor.id,
          updatedByName: actor.name,
          updatedAt: new Date().toISOString(),
        };
        window.dispatchEvent(new Event("matrundan:reload"));
      } else {
        next = updateLocalGroupPlacePracticalInfo(groupId, place.id, nextInput, actor, storageKind);
      }
      setPracticalInfo(next);
      setCompareOpen(false);
      toast.success("Gruppen använder nu den senaste kartdatan.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Uppgiften kunde inte uppdateras.");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-2xl border border-border/60 bg-background/45 p-3">
        <div className="flex min-h-9 items-center justify-between gap-2">
          <div className="font-medium">Praktisk information</div>
          <PlacePracticalInfoDialog
            place={place}
            groupId={groupId}
            practicalInfo={practicalInfo}
            externalWebsite={
              details?.website ?? normalizeWebsiteUrl(place.canonicalWebsite) ?? null
            }
            externalOpeningHours={details?.openingHours ?? null}
            disabled={!canEdit}
            onSaved={setPracticalInfo}
          />
        </div>

        <div className="mt-1 divide-y divide-border/50">
          <div className="flex min-h-11 items-center gap-2 py-1.5 text-sm">
            <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 font-medium">Webbplats</span>
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 max-w-[60%] items-center gap-1 truncate text-primary hover:underline"
                aria-label={`Öppna webbplatsen för ${place.name}`}
              >
                <span className="truncate">Öppna</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <span className="text-muted-foreground">Saknas</span>
            )}
            {practicalInfo.websiteOverride ? (
              <Badge variant="secondary" className="hidden rounded-full sm:inline-flex">
                Gruppen
              </Badge>
            ) : null}
          </div>

          <div className="py-1.5">
            {openingHours ? (
              <OpeningHoursDetails
                schedule={openingHours}
                timezone={details?.timezone ?? null}
                groupOverride={Boolean(practicalInfo.openingHoursOverride)}
              />
            ) : loading ? (
              <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Hämtar öppettider…
              </div>
            ) : (
              <div className="flex min-h-11 items-center gap-2 text-sm">
                <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">Öppettider</span>
                <span className="ml-auto text-muted-foreground">Saknas</span>
              </div>
            )}
          </div>
        </div>

        {hasConflict ? (
          <button
            type="button"
            className="mt-2 flex w-full items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-left text-xs text-amber-950 dark:bg-amber-950/25 dark:text-amber-100"
            onClick={() => setCompareOpen(true)}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Kartdatan har ändrats.</strong> Jämför innan gruppens uppgift ersätts.
            </span>
          </button>
        ) : null}

        <CrossGroupPracticalInfoSuggestions
          groupId={groupId}
          placeId={place.id}
          enabled={canEdit}
          onApplied={loadPracticalInfo}
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-relaxed text-muted-foreground">
          {practicalInfo.updatedAt ? (
            <span>
              Gruppens uppgift ändrad {formattedFetchedAt(practicalInfo.updatedAt)}
              {practicalInfo.updatedByName ? ` av ${practicalInfo.updatedByName}` : ""}.
            </span>
          ) : details ? (
            <span>
              {details.attribution} {fetchedLabel ? `Hämtat ${fetchedLabel}.` : ""}
            </span>
          ) : practicalInfoError ? (
            <span>{practicalInfoError}</span>
          ) : hasGeoapifySource && error ? (
            <span>{error}</span>
          ) : (
            <span>Ingen extern platsdata tillgänglig.</span>
          )}
          {practicalInfo.sourceUrl ? (
            <a
              href={practicalInfo.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Visa källa <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          {mode === "live" && hasGeoapifySource ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={refreshing || loading}
              onClick={() => void loadExternalDetails(true)}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Hämta senaste kartdata
            </Button>
          ) : null}
        </div>
      </div>

      <a
        href={googleMapsUrl(place)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 px-1 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        aria-label={`Öppna ${place.name} i Google Maps`}
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Google Maps
      </a>

      <AlertDialog open={compareOpen} onOpenChange={setCompareOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jämför med senaste kartdatan</AlertDialogTitle>
            <AlertDialogDescription>
              Matrundan skriver aldrig över gruppens egen uppgift automatiskt. Välj om gruppen ska
              behålla den eller återgå till kartdatan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            {websiteConflict ? (
              <div className="rounded-xl border border-border/70 p-3">
                <div className="font-medium">Webbplats</div>
                <div className="mt-1 break-all text-muted-foreground">
                  Gruppen: {practicalInfo.websiteOverride}
                </div>
                <div className="mt-1 break-all text-muted-foreground">
                  Kartdata: {details?.website}
                </div>
              </div>
            ) : null}
            {openingHoursConflict ? (
              <div className="rounded-xl border border-border/70 p-3">
                <div className="font-medium">Öppettider</div>
                <p className="mt-1 text-muted-foreground">
                  Veckoschemat i kartdatan skiljer sig från gruppens uppgift. Visa respektive schema
                  på detaljsidan innan du väljer.
                </p>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Behåll gruppens uppgift</AlertDialogCancel>
            <AlertDialogAction disabled={!canEdit} onClick={() => void applyMapDataForConflicts()}>
              Använd kartdatan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
