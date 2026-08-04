import * as React from "react";
import { ChevronDown, Clock3, ExternalLink, Globe2, Info, Loader2 } from "lucide-react";
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
import { useStore } from "@/lib/matrundan/store";
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

function scheduleEqual(
  left: OpeningHoursSchedule | null,
  right: OpeningHoursSchedule | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function OpeningHoursScheduleList({
  schedule,
  timezone,
}: {
  schedule: OpeningHoursSchedule;
  timezone: string | null;
}) {
  const today = openingHoursForDate(schedule, new Date(), timezone);

  return (
    <>
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
          Specialdagar eller ovanliga regler kan avvika. Kontrollera gärna ställets egen information
          före besöket.
        </p>
      ) : null}
    </>
  );
}

function OpeningHoursDetails({
  schedule,
  timezone,
}: {
  schedule: OpeningHoursSchedule;
  timezone: string | null;
}) {
  const today = openingHoursForDate(schedule, new Date(), timezone);
  const todaySummary = openingHoursDaySummary(today);

  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-1.5 text-sm marker:content-none">
        <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 font-medium">Öppettider idag</span>
        <span className="min-w-0 truncate text-right text-muted-foreground">{todaySummary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/50 pb-2 pl-6 pt-2.5">
        <OpeningHoursScheduleList schedule={schedule} timezone={timezone} />
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
          : "Webbplats och öppettider kunde inte hämtas.",
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
          toast.success("Ny information har sökts.", {
            description: "Gruppens uppgifter är oförändrade.",
          });
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Informationen kunde inte hämtas just nu.",
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
  const canEdit = canReport && !demoReadOnly && !practicalInfoError;

  async function applyNewInformationForConflicts() {
    if (!actor) return;
    const websiteOverride = websiteConflict ? null : practicalInfo.websiteOverride;
    const openingHoursOverride = openingHoursConflict ? null : practicalInfo.openingHoursOverride;
    const hasRemainingOverride = Boolean(websiteOverride || openingHoursOverride);
    const nextInput = {
      websiteOverride,
      openingHoursOverride,
      sourceUrl: hasRemainingOverride ? practicalInfo.sourceUrl : null,
      sourceNote: hasRemainingOverride ? practicalInfo.sourceNote : null,
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
      toast.success("Gruppen använder nu de nya uppgifterna.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Uppgiften kunde inte uppdateras.");
    }
  }

  return (
    <div className="mt-3 border-y border-border/50">
      <div className="flex min-h-9 items-center justify-between gap-2 py-1">
        <div className="text-xs font-medium text-muted-foreground">Webbplats och öppettider</div>
        <PlacePracticalInfoDialog
          place={place}
          groupId={groupId}
          practicalInfo={practicalInfo}
          externalWebsite={details?.website ?? normalizeWebsiteUrl(place.canonicalWebsite) ?? null}
          externalOpeningHours={details?.openingHours ?? null}
          disabled={!canEdit}
          canRefreshExternal={mode === "live" && hasGeoapifySource}
          refreshingExternal={refreshing || loading}
          onRefreshExternal={() => loadExternalDetails(true)}
          onSaved={setPracticalInfo}
        />
      </div>

      <div className="divide-y divide-border/50">
        <div className="flex min-h-11 items-center gap-2 py-1.5 text-sm">
          <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 font-medium">Webbplats</span>
          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 shrink-0 items-center gap-1 text-primary hover:underline"
              aria-label={`Öppna webbplatsen för ${place.name}`}
            >
              Öppna
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          ) : (
            <span className="shrink-0 text-muted-foreground">Saknas</span>
          )}
        </div>

        <div className="py-1.5">
          {openingHours ? (
            <OpeningHoursDetails schedule={openingHours} timezone={details?.timezone ?? null} />
          ) : loading ? (
            <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Hämtar öppettider…
            </div>
          ) : (
            <div className="flex min-h-11 items-center gap-2 text-sm">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">Öppettider idag</span>
              <span className="ml-auto text-muted-foreground">Saknas</span>
            </div>
          )}
        </div>
      </div>

      {hasConflict ? (
        <button
          type="button"
          className="my-2 flex min-h-11 w-full items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          onClick={() => setCompareOpen(true)}
        >
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">Det finns nya uppgifter om stället</span>
          <span className="shrink-0 font-medium text-primary">Jämför</span>
        </button>
      ) : null}

      <CrossGroupPracticalInfoSuggestions
        groupId={groupId}
        placeId={place.id}
        enabled={canEdit}
        onApplied={loadPracticalInfo}
      />

      {practicalInfoError || (hasGeoapifySource && error && !details) ? (
        <p role="status" className="pb-2 text-xs leading-relaxed text-muted-foreground">
          {practicalInfoError ?? error}
        </p>
      ) : null}

      <AlertDialog open={compareOpen} onOpenChange={setCompareOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Jämför uppgifter</AlertDialogTitle>
            <AlertDialogDescription>
              Matrundan ändrar aldrig gruppens uppgifter automatiskt. Välj vilka uppgifter gruppen
              ska använda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 text-sm">
            {websiteConflict ? (
              <section className="space-y-2 rounded-xl border border-border/70 p-3">
                <h3 className="font-medium">Webbplats</h3>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Nuvarande uppgift</div>
                  <div className="mt-0.5 break-all">{practicalInfo.websiteOverride}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Nya uppgifter</div>
                  <div className="mt-0.5 break-all">{details?.website}</div>
                </div>
              </section>
            ) : null}
            {openingHoursConflict && practicalInfo.openingHoursOverride && details?.openingHours ? (
              <section className="space-y-3 rounded-xl border border-border/70 p-3">
                <h3 className="font-medium">Öppettider</h3>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Nuvarande uppgift
                  </div>
                  <OpeningHoursScheduleList
                    schedule={practicalInfo.openingHoursOverride}
                    timezone={details.timezone ?? null}
                  />
                </div>
                <div className="border-t border-border/60 pt-3">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Nya uppgifter
                  </div>
                  <OpeningHoursScheduleList
                    schedule={details.openingHours}
                    timezone={details.timezone ?? null}
                  />
                </div>
              </section>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Behåll nuvarande</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canEdit}
              onClick={() => void applyNewInformationForConflicts()}
            >
              Använd de nya uppgifterna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
