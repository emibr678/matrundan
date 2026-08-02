import * as React from "react";
import { ChevronDown, Clock3, ExternalLink, Globe2, Loader2, RefreshCw } from "lucide-react";

import { PlaceDataReportDialog } from "./PlaceDataReportDialog";
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
import { useSession } from "@/lib/matrundan/session";
import { googleMapsUrl } from "@/lib/matrundan/store";
import type { Place } from "@/lib/matrundan/types";

const CACHE_PREFIX = "matrundan.place-external-info.v1";
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

function OpeningHoursDetails({ schedule }: { schedule: OpeningHoursSchedule }) {
  const today = openingHoursForDate(schedule);
  const todaySummary = openingHoursDaySummary(today);

  return (
    <details className="group rounded-xl border border-border/60 bg-background/55">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm marker:content-none">
        <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Öppettider idag</span>
          <span className="ml-1.5 text-muted-foreground">{todaySummary}</span>
        </span>
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
  const key = React.useMemo(() => cacheKey(place), [place]);
  const [details, setDetails] = React.useState<PlaceExternalDetails | null>(() =>
    key ? readCache(key) : null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    setDetails(key ? readCache(key) : null);
    setLoading(false);
    setError(null);
    setRetry(0);
  }, [key]);

  React.useEffect(() => {
    if (mode !== "live" || exampleMode || !key || details) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void geoapifyPlaceDetails({ data: { groupId, placeId: place.id } })
      .then((nextDetails) => {
        if (cancelled) return;
        setDetails(nextDetails);
        writeCache(key, nextDetails);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Platsinformationen kunde inte hämtas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [details, exampleMode, groupId, key, mode, place.id, retry]);

  if (exampleMode) return null;

  const websiteUrl = normalizeWebsiteUrl(place.website) ?? normalizeWebsiteUrl(details?.website);
  const hasGeoapifySource = Boolean(key);
  const sourceDetailsPending = hasGeoapifySource && !details && loading;
  const sourceDetailsFailed = hasGeoapifySource && !details && Boolean(error);
  const fetchedLabel = details ? formattedFetchedAt(details.fetchedAt) : "";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            aria-label={`Öppna webbplatsen för ${place.name}`}
          >
            <Globe2 className="h-3.5 w-3.5 shrink-0" /> Webbplats
          </a>
        ) : sourceDetailsPending ? (
          <div className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> Hämtar webbplats…
          </div>
        ) : sourceDetailsFailed ? (
          <div className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 shrink-0" /> Webbplats kunde inte hämtas
          </div>
        ) : (
          <div className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            <span>Webbplats saknas</span>
            {canReport ? (
              <PlaceDataReportDialog
                place={place}
                compact
                initialCategory="wrong_website"
                triggerLabel="Lägg till"
              />
            ) : null}
          </div>
        )}
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          aria-label={`Öppna ${place.name} i Google Maps`}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Google Maps
        </a>
      </div>

      {details?.openingHours ? (
        <OpeningHoursDetails schedule={details.openingHours} />
      ) : loading ? (
        <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Hämtar öppettider…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-border/70 px-3 py-2.5">
          <div className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4 shrink-0" /> Öppettider kunde inte hämtas
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] leading-relaxed text-muted-foreground">
            <span>{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setDetails(null);
                setError(null);
                setRetry((value) => value + 1);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Försök igen
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 px-3 py-2.5">
          <div className="flex min-h-8 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              {hasGeoapifySource ? "Öppettider saknas i kartdatan" : "Öppettider saknas"}
            </span>
            {canReport ? (
              <PlaceDataReportDialog
                place={place}
                compact
                initialCategory="wrong_opening_hours"
                triggerLabel="Komplettera"
              />
            ) : null}
          </div>
        </div>
      )}

      {details ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {details.attribution}
          {fetchedLabel ? ` Hämtat ${fetchedLabel}.` : ""} Uppgifterna kan vara inaktuella.
        </p>
      ) : null}
    </div>
  );
}
