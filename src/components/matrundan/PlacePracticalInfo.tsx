import * as React from "react";
import { ChevronDown, Clock3, ExternalLink, Globe2, Info, Loader2, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  geoapifyPlaceDetails,
  type PlaceExternalDetails,
} from "@/lib/matrundan/geoapify-place-details.functions";
import {
  openingHoursDaySummary,
  openingHoursForDate,
  type OpeningHoursSchedule,
} from "@/lib/matrundan/opening-hours";
import {
  createGroupPlaceDataReport,
  createLocalPlaceDataReport,
} from "@/lib/matrundan/place-data-reports";
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

function reportDescription(sourceUrl: string, sourceNote: string | null): string {
  return [
    "Webbplatsen har lagts till i gruppen och bör kontrolleras mot kartdatan.",
    sourceNote ? `Observation: ${sourceNote}` : null,
    `Källa: ${sourceUrl}`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);
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

interface PlacePracticalInfoContextValue {
  place: Place;
  groupId: string;
  practicalInfo: GroupPlacePracticalInfo;
  details: PlaceExternalDetails | null;
  websiteUrl: string | null;
  openingHours: OpeningHoursSchedule | null;
  todaySummary: string | null;
  websiteConflict: boolean;
  openingHoursConflict: boolean;
  hasConflict: boolean;
  hasGeoapifySource: boolean;
  canEdit: boolean;
  loading: boolean;
  refreshing: boolean;
  websitePending: boolean;
  error: string | null;
  practicalInfoError: string | null;
  loadPracticalInfo: () => Promise<void>;
  loadExternalDetails: (forceRefresh?: boolean) => Promise<void>;
  setPracticalInfo: React.Dispatch<React.SetStateAction<GroupPlacePracticalInfo>>;
  saveWebsite: (website: string, sourceNote: string) => Promise<void>;
  applyNewInformationForConflicts: () => Promise<void>;
}

const PlacePracticalInfoContext = React.createContext<PlacePracticalInfoContextValue | null>(null);

function usePlacePracticalInfo() {
  const value = React.useContext(PlacePracticalInfoContext);
  if (!value) throw new Error("PlacePracticalInfoProvider saknas.");
  return value;
}

export function PlacePracticalInfoProvider({
  place,
  groupId,
  canReport,
  children,
}: {
  place: Place;
  groupId: string;
  canReport: boolean;
  children: React.ReactNode;
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
  const [practicalInfoLoaded, setPracticalInfoLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [practicalInfoError, setPracticalInfoError] = React.useState<string | null>(null);
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
        caught instanceof Error ? caught.message : "Webbplats och öppettider kunde inte hämtas.",
      );
    } finally {
      setPracticalInfoLoaded(true);
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
  const today = openingHours
    ? openingHoursForDate(openingHours, new Date(), details?.timezone ?? null)
    : null;
  const todaySummary = today ? openingHoursDaySummary(today) : null;
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
  const externalPending = mode === "live" && !exampleMode && Boolean(key) && !details && !error;
  const websitePending = !practicalInfoLoaded || externalPending;

  const saveWebsite = React.useCallback(
    async (website: string, sourceNote: string) => {
      if (!actor) throw new Error("Medlemmen kunde inte identifieras.");
      const normalizedWebsite = normalizeWebsiteUrl(website);
      if (!normalizedWebsite) throw new Error("Ange en giltig webbplats.");

      const normalizedSourceNote = sourceNote.trim() || null;
      const websiteOverride = normalizedWebsite;
      const combinedSourceNote =
        [practicalInfo.sourceNote, normalizedSourceNote]
          .filter(Boolean)
          .join("\n")
          .slice(0, 1000) || null;
      const nextInput = {
        websiteOverride,
        openingHoursOverride: practicalInfo.openingHoursOverride,
        sourceUrl: practicalInfo.sourceUrl ?? normalizedWebsite,
        sourceNote: combinedSourceNote,
      };

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
      try {
        const description = reportDescription(normalizedWebsite, normalizedSourceNote);
        if (mode === "live") {
          await createGroupPlaceDataReport(groupId, place.id, {
            category: "wrong_website",
            description,
          });
        } else {
          createLocalPlaceDataReport(
            groupId,
            place,
            actor,
            { category: "wrong_website", description },
            storageKind,
          );
        }
        window.dispatchEvent(new Event("matrundan:place-data-reports-changed"));
      } catch {
        toast.warning("Webbplatsen sparades, men granskningsunderlaget kunde inte skapas.");
      }

      toast.success("Webbplatsen är tillagd för gruppen.", {
        description: "Den publiceras inte externt automatiskt.",
      });
    },
    [actor, groupId, mode, place, practicalInfo, storageKind],
  );

  const applyNewInformationForConflicts = React.useCallback(async () => {
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
      toast.success("Gruppen använder nu de nya uppgifterna.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Uppgiften kunde inte uppdateras.");
    }
  }, [
    actor,
    groupId,
    mode,
    openingHoursConflict,
    place.id,
    practicalInfo,
    storageKind,
    websiteConflict,
  ]);

  const value = React.useMemo<PlacePracticalInfoContextValue>(
    () => ({
      place,
      groupId,
      practicalInfo,
      details,
      websiteUrl,
      openingHours,
      todaySummary,
      websiteConflict,
      openingHoursConflict,
      hasConflict,
      hasGeoapifySource,
      canEdit,
      loading,
      refreshing,
      websitePending,
      error,
      practicalInfoError,
      loadPracticalInfo,
      loadExternalDetails,
      setPracticalInfo,
      saveWebsite,
      applyNewInformationForConflicts,
    }),
    [
      place,
      groupId,
      practicalInfo,
      details,
      websiteUrl,
      openingHours,
      todaySummary,
      websiteConflict,
      openingHoursConflict,
      hasConflict,
      hasGeoapifySource,
      canEdit,
      loading,
      refreshing,
      websitePending,
      error,
      practicalInfoError,
      loadPracticalInfo,
      loadExternalDetails,
      saveWebsite,
      applyNewInformationForConflicts,
    ],
  );

  return (
    <PlacePracticalInfoContext.Provider value={value}>
      {children}
    </PlacePracticalInfoContext.Provider>
  );
}

function AddWebsiteDialog() {
  const { place, saveWebsite } = usePlacePracticalInfo();
  const [open, setOpen] = React.useState(false);
  const [website, setWebsite] = React.useState("");
  const [sourceNote, setSourceNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setWebsite("");
    setSourceNote("");
  }, [open]);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      await saveWebsite(website, sourceNote);
      setOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Webbplatsen kunde inte sparas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 min-h-11 justify-start px-2 text-sm font-medium text-primary"
        >
          <Plus className="h-4 w-4" /> Lägg till webbplats
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till webbplats</DialogTitle>
          <DialogDescription>
            Webbplatsen visas direkt för gruppen. Länken sparas också som privat underlag för
            granskning, men publiceras aldrig externt automatiskt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`place-website-${place.id}`}>Webbplats</Label>
            <Input
              id={`place-website-${place.id}`}
              inputMode="url"
              autoFocus
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`place-website-note-${place.id}`}>Kommentar till gruppens admin</Label>
            <Textarea
              id={`place-website-note-${place.id}`}
              rows={3}
              maxLength={1000}
              value={sourceNote}
              onChange={(event) => setSourceNote(event.target.value)}
              placeholder="Valfritt, till exempel var du hittade länken."
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={saving || !website.trim()} onClick={() => void submit()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lägg till för gruppen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlaceWebsiteInfo() {
  const { place, websiteUrl, canEdit, websitePending } = usePlacePracticalInfo();

  if (websitePending) return null;

  if (websiteUrl) {
    return (
      <a
        href={websiteUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-0.5 inline-flex min-h-11 max-w-full items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
        aria-label={`Öppna webbplatsen för ${place.name}`}
      >
        <Globe2 className="h-4 w-4 shrink-0" />
        <span>Webbplats</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
    );
  }

  return canEdit ? <AddWebsiteDialog /> : null;
}

export function PlaceOpeningHoursInfo() {
  const {
    place,
    groupId,
    practicalInfo,
    details,
    openingHours,
    todaySummary,
    websiteConflict,
    openingHoursConflict,
    hasConflict,
    hasGeoapifySource,
    canEdit,
    loading,
    refreshing,
    error,
    practicalInfoError,
    loadPracticalInfo,
    loadExternalDetails,
    setPracticalInfo,
    applyNewInformationForConflicts,
  } = usePlacePracticalInfo();
  const { mode } = useSession();
  const [compareOpen, setCompareOpen] = React.useState(false);
  const summary = loading ? "Hämtar…" : (todaySummary ?? "Saknas");

  async function applyComparedInformation() {
    await applyNewInformationForConflicts();
    setCompareOpen(false);
  }

  return (
    <details className="group mt-3 overflow-hidden rounded-2xl border border-border/60 bg-background/65 shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-sm marker:content-none">
        <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 font-medium">Öppettider</span>
        <span className="max-w-[8rem] truncate text-right text-muted-foreground">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-border/50 px-3 pb-3 pt-3">
        {canEdit ? (
          <div className="flex min-h-9 items-center justify-between gap-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Gruppens webbplats och öppettider
            </p>
            <PlacePracticalInfoDialog
              place={place}
              groupId={groupId}
              practicalInfo={practicalInfo}
              externalWebsite={
                details?.website ?? normalizeWebsiteUrl(place.canonicalWebsite) ?? null
              }
              externalOpeningHours={details?.openingHours ?? null}
              canRefreshExternal={mode === "live" && hasGeoapifySource}
              refreshingExternal={refreshing || loading}
              onRefreshExternal={() => loadExternalDetails(true)}
              onSaved={setPracticalInfo}
            />
          </div>
        ) : null}

        {openingHours ? (
          <section className="overflow-hidden rounded-xl border border-border/60">
            <div className="flex min-h-11 items-center gap-2 px-3 py-1.5 text-sm">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 font-medium">Idag</span>
              <span className="min-w-0 truncate text-right text-muted-foreground">
                {todaySummary}
              </span>
            </div>
            <div className="border-t border-border/50 px-3 py-3">
              <OpeningHoursScheduleList
                schedule={openingHours}
                timezone={details?.timezone ?? null}
              />
            </div>
          </section>
        ) : loading ? (
          <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Hämtar öppettider…
          </div>
        ) : (
          <p className="rounded-xl bg-muted/35 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            Öppettider saknas.
          </p>
        )}

        {hasConflict ? (
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
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
          <p role="status" className="text-xs leading-relaxed text-muted-foreground">
            {practicalInfoError ?? error}
          </p>
        ) : null}
      </div>

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
            <AlertDialogAction disabled={!canEdit} onClick={() => void applyComparedInformation()}>
              Använd de nya uppgifterna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </details>
  );
}
