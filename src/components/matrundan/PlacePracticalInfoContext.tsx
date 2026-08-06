import * as React from "react";
import { toast } from "sonner";

import {
  exampleExternalInfoForPlace,
  readExampleLocationOverride,
  writeExampleLocationOverride,
} from "@/lib/matrundan/example-place-external-info";
import {
  applyGeoapifyPlaceLocation,
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
import {
  comparePlaceLocation,
  type ExternalPlaceLocation,
  type PlaceLocationDiff,
} from "@/lib/matrundan/place-location-sync";
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

type PracticalInfoField = "website" | "opening_hours";

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

function withLocation(place: Place, location: ExternalPlaceLocation | null): Place {
  if (!location) return place;
  return {
    ...place,
    address: location.address,
    area: location.area ?? undefined,
    city: location.city,
    lat: location.lat,
    lng: location.lng,
  };
}

export interface PlacePracticalInfoContextValue {
  place: Place;
  effectivePlace: Place;
  groupId: string;
  practicalInfo: GroupPlacePracticalInfo;
  details: PlaceExternalDetails | null;
  websiteUrl: string | null;
  openingHours: OpeningHoursSchedule | null;
  todaySummary: string | null;
  websiteConflict: boolean;
  openingHoursConflict: boolean;
  hasConflict: boolean;
  hasExternalSource: boolean;
  canEdit: boolean;
  canApplyLocation: boolean;
  loading: boolean;
  refreshing: boolean;
  applyingLocation: boolean;
  websitePending: boolean;
  error: string | null;
  practicalInfoError: string | null;
  locationDiff: PlaceLocationDiff | null;
  loadPracticalInfo: () => Promise<void>;
  loadExternalDetails: (forceRefresh?: boolean) => Promise<void>;
  setPracticalInfo: React.Dispatch<React.SetStateAction<GroupPlacePracticalInfo>>;
  saveWebsite: (website: string, sourceNote: string) => Promise<void>;
  applyExternalPracticalInfo: (field: PracticalInfoField) => Promise<void>;
  applyExternalLocation: () => Promise<void>;
}

const PlacePracticalInfoContext = React.createContext<PlacePracticalInfoContextValue | null>(null);

export function usePlacePracticalInfo(): PlacePracticalInfoContextValue {
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
  const exampleScenario = React.useMemo(
    () => (exampleMode ? exampleExternalInfoForPlace(place) : null),
    [exampleMode, place],
  );
  const [exampleLocation, setExampleLocation] = React.useState<ExternalPlaceLocation | null>(() =>
    exampleMode ? readExampleLocationOverride(place.id) : null,
  );
  const [details, setDetails] = React.useState<PlaceExternalDetails | null>(() =>
    !exampleMode && key ? readCache(key) : null,
  );
  const [practicalInfo, setPracticalInfo] = React.useState<GroupPlacePracticalInfo>(
    emptyGroupPlacePracticalInfo,
  );
  const [practicalInfoLoaded, setPracticalInfoLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [applyingLocation, setApplyingLocation] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [practicalInfoError, setPracticalInfoError] = React.useState<string | null>(null);
  const storageKind = exampleMode ? "session" : "local";
  const actor = state.members.find((member) => member.id === state.currentUserId);
  const effectivePlace = React.useMemo(
    () => withLocation(place, exampleMode ? exampleLocation : null),
    [exampleLocation, exampleMode, place],
  );
  const hasExternalSource = exampleMode ? Boolean(exampleScenario) : Boolean(key);

  React.useEffect(() => {
    setExampleLocation(exampleMode ? readExampleLocationOverride(place.id) : null);
  }, [exampleMode, place.id]);

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
    setDetails(!exampleMode && key ? readCache(key) : null);
    setLoading(false);
    setRefreshing(false);
    setError(null);
  }, [exampleMode, key, place.id]);

  const loadExternalDetails = React.useCallback(
    async (forceRefresh = false) => {
      if (!hasExternalSource) return;
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        let nextDetails: PlaceExternalDetails;
        if (exampleMode) {
          await Promise.resolve();
          if (!exampleScenario || exampleScenario.error || !exampleScenario.details) {
            throw new Error(
              exampleScenario?.error ?? "Uppgifterna kunde inte kontrolleras just nu.",
            );
          }
          nextDetails = {
            ...exampleScenario.details,
            fetchedAt: new Date().toISOString(),
          };
        } else {
          if (!key) return;
          nextDetails = await geoapifyPlaceDetails({
            data: { groupId, placeId: place.id, forceRefresh },
          });
          writeCache(key, nextDetails);
        }
        setDetails(nextDetails);
        if (forceRefresh) {
          toast.success("Uppgifterna har kontrollerats.", {
            description: "Inget ändras förrän gruppen väljer att använda en ny uppgift.",
          });
        }
      } catch (caught) {
        setDetails(null);
        setError(
          caught instanceof Error ? caught.message : "Uppgifterna kunde inte kontrolleras just nu.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [exampleMode, exampleScenario, groupId, hasExternalSource, key, place.id],
  );

  React.useEffect(() => {
    if (!hasExternalSource || details || loading || error) return;
    void loadExternalDetails(false);
  }, [details, error, hasExternalSource, loadExternalDetails, loading]);

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
  const writableMember = canReport && !demoReadOnly;
  const canEdit = writableMember && !practicalInfoError;
  const currentMember = state.members.find((member) => member.id === state.currentUserId);
  const canApplyLocation =
    writableMember && (currentMember?.role === "ägare" || currentMember?.role === "admin");
  const locationDiff = comparePlaceLocation(effectivePlace, details?.location);
  const externalPending = hasExternalSource && !details && !error;
  const websitePending = !practicalInfoLoaded || externalPending;

  const persistPracticalInfo = React.useCallback(
    async (nextInput: {
      websiteOverride: string | null;
      openingHoursOverride: OpeningHoursSchedule | null;
      sourceUrl: string | null;
      sourceNote: string | null;
    }) => {
      if (!actor) throw new Error("Medlemmen kunde inte identifieras.");
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
    },
    [actor, groupId, mode, place.id, storageKind],
  );

  const saveWebsite = React.useCallback(
    async (website: string, sourceNote: string) => {
      if (!actor) throw new Error("Medlemmen kunde inte identifieras.");
      const normalizedWebsite = normalizeWebsiteUrl(website);
      if (!normalizedWebsite) throw new Error("Ange en giltig webbplats.");

      const normalizedSourceNote = sourceNote.trim() || null;
      const combinedSourceNote =
        [practicalInfo.sourceNote, normalizedSourceNote]
          .filter(Boolean)
          .join("\n")
          .slice(0, 1000) || null;
      const nextInput = {
        websiteOverride: normalizedWebsite,
        openingHoursOverride: practicalInfo.openingHoursOverride,
        sourceUrl: practicalInfo.sourceUrl ?? normalizedWebsite,
        sourceNote: combinedSourceNote,
      };

      await persistPracticalInfo(nextInput);
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
    [actor, groupId, mode, persistPracticalInfo, place, practicalInfo, storageKind],
  );

  const applyExternalPracticalInfo = React.useCallback(
    async (field: PracticalInfoField) => {
      if (!canEdit) return;
      const clearWebsite = field === "website" && websiteConflict;
      const clearOpeningHours = field === "opening_hours" && openingHoursConflict;
      if (!clearWebsite && !clearOpeningHours) return;

      const websiteOverride = clearWebsite ? null : practicalInfo.websiteOverride;
      const openingHoursOverride = clearOpeningHours ? null : practicalInfo.openingHoursOverride;
      const hasRemainingOverride = Boolean(websiteOverride || openingHoursOverride);
      await persistPracticalInfo({
        websiteOverride,
        openingHoursOverride,
        sourceUrl: hasRemainingOverride ? practicalInfo.sourceUrl : null,
        sourceNote: hasRemainingOverride ? practicalInfo.sourceNote : null,
      });
      toast.success(
        field === "website"
          ? "Gruppen använder nu kartdatans webbplats."
          : "Gruppen använder nu kartdatans öppettider.",
      );
    },
    [canEdit, openingHoursConflict, persistPracticalInfo, practicalInfo, websiteConflict],
  );

  const applyExternalLocation = React.useCallback(async () => {
    if (!canApplyLocation || !details?.location || !locationDiff?.hasChanges) return;
    setApplyingLocation(true);
    try {
      if (exampleMode) {
        writeExampleLocationOverride(place.id, details.location);
        setExampleLocation(details.location);
      } else {
        const result = await applyGeoapifyPlaceLocation({
          data: { groupId, placeId: place.id },
        });
        toast.success("Adressen och kartpositionen är uppdaterade.", {
          description: result.sourceLinked
            ? "Stället är också kopplat till sin OpenStreetMap-källa."
            : "Gruppens webbplats och öppettider är oförändrade.",
        });
        window.dispatchEvent(new Event("matrundan:reload"));
        return;
      }
      toast.success("Exempelgruppen använder nu den nya adressen.", {
        description: "Ändringen sparas bara i den här webbläsarfliken.",
      });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Kartdatan kunde inte användas.");
    } finally {
      setApplyingLocation(false);
    }
  }, [
    canApplyLocation,
    details?.location,
    exampleMode,
    groupId,
    locationDiff?.hasChanges,
    place.id,
  ]);

  const value = React.useMemo<PlacePracticalInfoContextValue>(
    () => ({
      place,
      effectivePlace,
      groupId,
      practicalInfo,
      details,
      websiteUrl,
      openingHours,
      todaySummary,
      websiteConflict,
      openingHoursConflict,
      hasConflict,
      hasExternalSource,
      canEdit,
      canApplyLocation,
      loading,
      refreshing,
      applyingLocation,
      websitePending,
      error,
      practicalInfoError,
      locationDiff,
      loadPracticalInfo,
      loadExternalDetails,
      setPracticalInfo,
      saveWebsite,
      applyExternalPracticalInfo,
      applyExternalLocation,
    }),
    [
      place,
      effectivePlace,
      groupId,
      practicalInfo,
      details,
      websiteUrl,
      openingHours,
      todaySummary,
      websiteConflict,
      openingHoursConflict,
      hasConflict,
      hasExternalSource,
      canEdit,
      canApplyLocation,
      loading,
      refreshing,
      applyingLocation,
      websitePending,
      error,
      practicalInfoError,
      locationDiff,
      loadPracticalInfo,
      loadExternalDetails,
      saveWebsite,
      applyExternalPracticalInfo,
      applyExternalLocation,
    ],
  );

  return (
    <PlacePracticalInfoContext.Provider value={value}>
      {children}
    </PlacePracticalInfoContext.Provider>
  );
}
