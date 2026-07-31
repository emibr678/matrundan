import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  List,
  Loader2,
  Map,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "@/components/matrundan/FoodTagMultiSelect";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";
import {
  MultiAreaPlaceMap,
  type MultiAreaMapItem,
} from "@/components/matrundan/MultiAreaPlaceMap";
import { OccasionPicker } from "@/components/matrundan/OccasionPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  geoapifySearchPlacesMulti,
  type MultiAreaPlaceSuggestion,
} from "@/lib/matrundan/geoapify.functions";
import {
  listOwnVisitsForPlaceOnAdd,
  shareVisitToGroup,
  type OwnVisitForPlace,
} from "@/lib/matrundan/live-sharing";
import { primaryOccasion } from "@/lib/matrundan/occasions";
import {
  demoSearchAreaFromText,
  getPlacesProvider,
  type PlaceSuggestion,
} from "@/lib/matrundan/places-provider";
import {
  mergeAreaSearchResults,
  SEARCH_RADIUS_OPTIONS,
  shortSearchAreaLabel,
} from "@/lib/matrundan/search-areas";
import { useSession } from "@/lib/matrundan/session";
import {
  availableOwnVisits,
  formatMealType,
  formatOwnVisitDate,
  toggleAllSelection,
} from "@/lib/matrundan/sharing-selection";
import { useStore } from "@/lib/matrundan/store";
import {
  CATEGORY_LABEL,
  type Occasion,
  type Place,
  type PlaceCategory,
  type SearchArea,
  type SearchRadiusKm,
} from "@/lib/matrundan/types";

const MAX_SEARCH_CENTERS = 5;

type ResultView = "lista" | "karta";
type Tab = "sok" | "manuell";
type ResultStatus = "available" | "existing";

type ManualDraft = {
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string;
  area: string;
  city: string;
  occasions: Occasion[];
  notes: string;
  photo: string;
};

function providerMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Kunde inte hämta förslag.";
  if (/GEOAPIFY_NOT_CONFIGURED/i.test(message)) {
    return "Platssökningen är inte aktiverad på servern. Lägg till stället manuellt tills den är konfigurerad.";
  }
  if (/GEOAPIFY_RATE_LIMIT/i.test(message)) {
    return "Sökningen används mycket just nu. Försök igen om en stund.";
  }
  if (/GEOAPIFY_TIMEOUT/i.test(message)) return "Sökningen tog för lång tid. Försök igen.";
  if (/GEOAPIFY_|network|fetch/i.test(message)) {
    return "Kunde inte nå platstjänsten just nu. Försök igen strax.";
  }
  return message;
}

function emptyManual(city: string): ManualDraft {
  return {
    name: "",
    category: "restaurang",
    cuisines: [],
    address: "",
    area: "",
    city,
    occasions: [],
    notes: "",
    photo: "🍽️",
  };
}

function normalizeMatch(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

function matchingPlace(places: Place[], suggestion: PlaceSuggestion) {
  const name = normalizeMatch(suggestion.name);
  const address = normalizeMatch(suggestion.address);
  const city = normalizeMatch(suggestion.city);
  return places.find((place) => {
    if (normalizeMatch(place.name) !== name) return false;
    const placeAddress = normalizeMatch(place.address);
    if (address && placeAddress) return placeAddress === address;
    return normalizeMatch(place.city) === city;
  });
}

function demoAreas(city: string): SearchArea[] {
  if (city.toLocaleLowerCase("sv-SE").includes("stockholm")) {
    return [
      {
        id: "demo-area-sodermalm",
        label: "Södermalm, Stockholm",
        lat: 59.3153,
        lng: 18.0711,
        provider: "demo",
        placeId: "demo:sodermalm",
      },
      {
        id: "demo-area-vasastan-stockholm",
        label: "Vasastan, Stockholm",
        lat: 59.3427,
        lng: 18.0491,
        provider: "demo",
        placeId: "demo:vasastan-stockholm",
      },
    ];
  }
  return [
    {
      id: "demo-area-haga",
      label: "Haga, Göteborg",
      lat: 57.6994,
      lng: 11.9556,
      provider: "demo",
      placeId: "demo:haga",
    },
    {
      id: "demo-area-vasastan",
      label: "Vasastan, Göteborg",
      lat: 57.6975,
      lng: 11.9598,
      provider: "demo",
      placeId: "demo:vasastan",
    },
    {
      id: "demo-area-linne",
      label: "Linné, Göteborg",
      lat: 57.6963,
      lng: 11.9464,
      provider: "demo",
      placeId: "demo:linne",
    },
  ];
}

function configuredAreas(state: ReturnType<typeof useStore>["state"], isLive: boolean): SearchArea[] {
  const areas = (state.group.searchAreas ?? []).filter(
    (area) => Number.isFinite(area.lat) && Number.isFinite(area.lng) && area.placeId.trim(),
  );
  if (areas.length > 0) return areas;
  const home = state.group.homeLocation;
  if (
    home?.verified &&
    home.lat != null &&
    home.lng != null &&
    home.placeId &&
    home.provider === "geoapify"
  ) {
    return [
      {
        id: `legacy-${home.placeId}`,
        label: home.label,
        lat: home.lat,
        lng: home.lng,
        provider: "geoapify",
        placeId: home.placeId,
      },
    ];
  }
  return isLive ? [] : demoAreas(state.group.city);
}

function toSuggestion(row: MultiAreaPlaceSuggestion): PlaceSuggestion {
  return {
    externalId: row.externalId,
    provider: row.provider,
    name: row.name,
    category: row.category,
    cuisines: row.cuisines,
    address: row.address,
    city: row.city,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    distanceKm: row.distanceKm,
    raw: row.raw,
    nearestAreaLabel: row.nearestAreaLabel,
    matchingAreaLabels: row.matchingAreaLabels,
  };
}

export function AddPlaceDialogV16({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, addPlace, addProviderPlace, submitting } = useStore();
  const { mode, activeGroupId } = useSession();
  const isLive = mode === "live";
  const savedAreas = React.useMemo(
    () => configuredAreas(state, isLive),
    [isLive, state],
  );

  const [tab, setTab] = React.useState<Tab>("sok");
  const [query, setQuery] = React.useState("");
  const [selectedAreaIds, setSelectedAreaIds] = React.useState<string[]>(() =>
    savedAreas.map((area) => area.id),
  );
  const [temporaryArea, setTemporaryArea] = React.useState<SearchArea | null>(null);
  const [showOtherLocation, setShowOtherLocation] = React.useState(savedAreas.length === 0);
  const [otherLocationText, setOtherLocationText] = React.useState("");
  const [otherLocationCandidate, setOtherLocationCandidate] = React.useState<SearchArea | null>(null);
  const [radiusKm, setRadiusKm] = React.useState<SearchRadiusKm>(
    state.group.defaultSearchRadiusKm ?? 1,
  );
  const [results, setResults] = React.useState<PlaceSuggestion[]>([]);
  const [failedAreas, setFailedAreas] = React.useState<string[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [resultView, setResultView] = React.useState<ResultView>("lista");
  const [existingOpen, setExistingOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PlaceSuggestion | null>(null);
  const [pendingCuisines, setPendingCuisines] = React.useState<string[]>([]);
  const [pendingOccasions, setPendingOccasions] = React.useState<Occasion[]>([]);
  const [pendingNotes, setPendingNotes] = React.useState("");
  const [manual, setManual] = React.useState<ManualDraft>(() => emptyManual(state.group.city));
  const [addedResultIds, setAddedResultIds] = React.useState<Set<string>>(() => new Set());
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [syncPlaceName, setSyncPlaceName] = React.useState("");
  const [syncVisits, setSyncVisits] = React.useState<OwnVisitForPlace[]>([]);
  const [syncVisitIds, setSyncVisitIds] = React.useState<string[]>([]);
  const [syncShareComment, setSyncShareComment] = React.useState(false);
  const [syncBusy, setSyncBusy] = React.useState(false);
  const requestRef = React.useRef(0);
  const isBusy = busy || submitting || syncBusy;
  const allSyncVisitsSelected =
    syncVisits.length > 0 && syncVisits.every((visit) => syncVisitIds.includes(visit.visitId));

  React.useEffect(() => {
    setSelectedAreaIds(savedAreas.map((area) => area.id));
    setRadiusKm(state.group.defaultSearchRadiusKm ?? 1);
    setShowOtherLocation(savedAreas.length === 0);
  }, [savedAreas, state.group.defaultSearchRadiusKm]);

  const activeAreas = React.useMemo(() => {
    const selected = savedAreas.filter((area) => selectedAreaIds.includes(area.id));
    return temporaryArea ? [...selected, temporaryArea].slice(0, MAX_SEARCH_CENTERS) : selected;
  }, [savedAreas, selectedAreaIds, temporaryArea]);

  React.useEffect(() => {
    if (!open || tab !== "sok" || activeAreas.length === 0) {
      setResults([]);
      setFailedAreas([]);
      setError(null);
      return;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      setFailedAreas([]);
      try {
        let nextResults: PlaceSuggestion[];
        let nextFailedAreas: string[] = [];
        if (isLive) {
          const response = await geoapifySearchPlacesMulti({
            data: {
              text: query.trim() || undefined,
              centers: activeAreas.map((area) => ({
                id: area.id,
                label: shortSearchAreaLabel(area.label),
                lat: area.lat,
                lng: area.lng,
              })),
              radiusKm,
              limit: 50,
            },
          });
          nextResults = response.results.map(toSuggestion);
          nextFailedAreas = response.failedAreaLabels;
        } else {
          const settled = await Promise.allSettled(
            activeAreas.map(async (area) => ({
              area,
              results: await getPlacesProvider().search({
                query: query.trim() || undefined,
                center: { lat: area.lat, lng: area.lng },
                areaLabel: shortSearchAreaLabel(area.label),
                radiusKm,
              }),
            })),
          );
          const successful = settled.flatMap((outcome) =>
            outcome.status === "fulfilled"
              ? [
                  {
                    areaId: outcome.value.area.id,
                    areaLabel: shortSearchAreaLabel(outcome.value.area.label),
                    results: outcome.value.results,
                  },
                ]
              : [],
          );
          nextFailedAreas = settled.flatMap((outcome, index) =>
            outcome.status === "rejected" ? [shortSearchAreaLabel(activeAreas[index].label)] : [],
          );
          if (successful.length === 0 && nextFailedAreas.length > 0) {
            throw new Error("Kunde inte söka i de valda områdena.");
          }
          nextResults = mergeAreaSearchResults(successful, 50);
        }
        if (requestId !== requestRef.current) return;
        setResults(nextResults);
        setFailedAreas(nextFailedAreas);
        setSelectedId(nextResults[0]?.externalId ?? null);
      } catch (caught) {
        if (requestId !== requestRef.current) return;
        setResults([]);
        setError(providerMessage(caught));
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeAreas, isLive, open, query, radiusKm, retry, tab]);

  const statusForResult = React.useCallback(
    (suggestion: PlaceSuggestion): ResultStatus => {
      if (addedResultIds.has(suggestion.externalId)) return "existing";
      const match = matchingPlace(state.places, suggestion);
      return match?.collectionStatus === "active" ? "existing" : "available";
    },
    [addedResultIds, state.places],
  );

  const availableResults = React.useMemo(
    () => results.filter((result) => statusForResult(result) === "available"),
    [results, statusForResult],
  );
  const existingResults = React.useMemo(
    () => results.filter((result) => statusForResult(result) === "existing"),
    [results, statusForResult],
  );

  React.useEffect(() => {
    const visible = existingOpen ? results : availableResults;
    if (!visible.some((result) => result.externalId === selectedId)) {
      setSelectedId(visible[0]?.externalId ?? null);
    }
  }, [availableResults, existingOpen, results, selectedId]);

  function toggleArea(areaId: string) {
    setSelectedAreaIds((current) =>
      current.includes(areaId) ? current.filter((id) => id !== areaId) : [...current, areaId],
    );
  }

  function useOtherLocation() {
    if (isLive) {
      if (!otherLocationCandidate || otherLocationText.trim() !== otherLocationCandidate.label.trim()) {
        toast.error("Välj platsen från listan.");
        return;
      }
      setTemporaryArea(otherLocationCandidate);
    } else {
      const area = demoSearchAreaFromText(otherLocationText, state.group.city);
      if (!area) {
        toast.error("Ange ett område eller en stad.");
        return;
      }
      setTemporaryArea(area);
    }
    setOtherLocationText("");
    setOtherLocationCandidate(null);
    setShowOtherLocation(false);
  }

  function beginAdd(suggestion: PlaceSuggestion) {
    if (statusForResult(suggestion) === "existing") return;
    setSelectedId(suggestion.externalId);
    setPending(suggestion);
    setPendingCuisines(suggestion.cuisines ?? []);
    setPendingOccasions([]);
    setPendingNotes("");
  }

  function closePending() {
    if (isBusy) return;
    setPending(null);
    setPendingCuisines([]);
    setPendingOccasions([]);
    setPendingNotes("");
  }

  function closeSync() {
    if (syncBusy) return;
    setSyncOpen(false);
    setSyncPlaceName("");
    setSyncVisits([]);
    setSyncVisitIds([]);
    setSyncShareComment(false);
  }

  async function confirmAdd() {
    if (!pending || isBusy) return;
    const shouldOfferSync =
      isLive && !!activeGroupId && !!pending.provider && pending.provider !== "demo";
    setBusy(true);
    try {
      const place = {
        name: pending.name,
        category: pending.category,
        cuisines: pendingCuisines,
        occasions: pendingOccasions,
        address: pending.address,
        area: pending.area,
        city: pending.city,
        lat: pending.lat,
        lng: pending.lng,
        addedBy: state.currentUserId,
        photo: emojiForCategory(pending.category),
        notes: pendingNotes.trim() || undefined,
      };
      const added =
        isLive && pending.provider && pending.provider !== "demo"
          ? await addProviderPlace({
              provider: pending.provider,
              providerPlaceId: pending.externalId,
              place,
              raw: safeParse(pending.raw),
            })
          : await addPlace(place);
      setAddedResultIds((current) => new Set(current).add(pending.externalId));
      setPending(null);
      setPendingCuisines([]);
      setPendingOccasions([]);
      setPendingNotes("");
      toast.success(`${added.name} tillagd i gruppen`);

      if (shouldOfferSync && activeGroupId) {
        try {
          const ownVisits = await listOwnVisitsForPlaceOnAdd(added.id, activeGroupId);
          const shareableVisits = availableOwnVisits(ownVisits);
          if (shareableVisits.length > 0) {
            setSyncPlaceName(added.name);
            setSyncVisits(shareableVisits);
            setSyncVisitIds([]);
            setSyncShareComment(false);
            setSyncOpen(true);
          }
        } catch (caught) {
          toast.warning("Stället lades till, men tidigare besök kunde inte hämtas.", {
            description:
              caught instanceof Error
                ? caught.message
                : "Försök igen från besökets detaljsida senare.",
          });
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Kunde inte lägga till stället.";
      if (/redan|already|duplicate|unique/i.test(message)) {
        setAddedResultIds((current) => new Set(current).add(pending.externalId));
        setPending(null);
        toast.info("Det här stället finns redan i gruppen.");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmSyncVisits() {
    if (!activeGroupId || syncVisitIds.length === 0 || syncBusy) return;
    setSyncBusy(true);
    const failedIds: string[] = [];
    const failedGroups: string[] = [];
    const successfulIds: string[] = [];
    for (const visitId of syncVisitIds) {
      const visit = syncVisits.find((candidate) => candidate.visitId === visitId);
      if (!visit) continue;
      try {
        await shareVisitToGroup(
          visitId,
          activeGroupId,
          visit.ownHasComment ? syncShareComment : false,
        );
        successfulIds.push(visitId);
      } catch {
        failedIds.push(visitId);
        failedGroups.push(visit.groupName);
      }
    }
    if (successfulIds.length > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("matrundan:reload"));
    }
    if (failedIds.length > 0) {
      setSyncVisits((current) => current.filter((visit) => failedIds.includes(visit.visitId)));
      setSyncVisitIds(failedIds);
      setSyncBusy(false);
      toast.warning("Några besök kunde inte delas.", {
        description: `${[...new Set(failedGroups)].join(", ")}. Försök igen eller hoppa över.`,
      });
      return;
    }
    setSyncBusy(false);
    closeSync();
    toast.success(
      `${successfulIds.length} ${successfulIds.length === 1 ? "besök delat" : "besök delade"} till gruppen`,
    );
  }

  async function submitManual() {
    if (!manual.name.trim() || isBusy) {
      if (!manual.name.trim()) toast.error("Ge stället ett namn");
      return;
    }
    if (!primaryOccasion(manual.occasions)) {
      toast.error("Välj vad stället passar bäst för");
      return;
    }
    setBusy(true);
    try {
      const added = await addPlace({
        name: manual.name.trim(),
        category: manual.category,
        cuisines: manual.cuisines,
        occasions: manual.occasions,
        address: manual.address.trim(),
        area: manual.area.trim() || undefined,
        city: manual.city.trim() || state.group.city,
        addedBy: state.currentUserId,
        notes: manual.notes.trim() || undefined,
        photo: manual.photo,
      });
      toast.success(`${added.name} tillagd i gruppen`);
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Kunde inte lägga till stället.");
    } finally {
      setBusy(false);
    }
  }

  const mapResults = existingOpen ? results : availableResults;
  const mapItems: MultiAreaMapItem[] = mapResults.map((result) => ({
    id: result.externalId,
    name: result.name,
    lat: result.lat,
    lng: result.lng,
    category: result.category,
    actionable: statusForResult(result) === "available",
    eyebrow: `${CATEGORY_LABEL[result.category]}${
      result.distanceKm != null
        ? ` · ~${result.distanceKm} km${
            result.nearestAreaLabel ? ` från ${result.nearestAreaLabel}` : ""
          }`
        : ""
    }`,
    description: [result.address, result.area, result.city].filter(Boolean).join(" · "),
  }));
  const unmappedCount = mapResults.filter(
    (result) => result.lat == null || result.lng == null,
  ).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Lägg till matställe</DialogTitle>
            <DialogDescription>
              Utforska gruppens vanliga områden eller välj en annan plats för den här sökningen.
            </DialogDescription>
          </DialogHeader>

          <TabToggle value={tab} onChange={setTab} />

          {tab === "sok" ? (
            <div className="space-y-4">
              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor="place-query">Vad är du sugen på?</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="place-query"
                      className="pl-9"
                      placeholder="Namn, kök eller kategori"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="place-radius">Sökradie</Label>
                  <Select
                    value={String(radiusKm)}
                    onValueChange={(value) => setRadiusKm(Number(value) as SearchRadiusKm)}
                  >
                    <SelectTrigger id="place-radius" className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_RADIUS_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value === 50 ? "Större område · inom 50 km" : `Inom ${value} km`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sökområden</Label>
                <div
                  className="flex min-w-0 flex-wrap gap-2"
                  role="group"
                  aria-label="Välj sökområden"
                >
                  {savedAreas.map((area) => {
                    const selected = selectedAreaIds.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleArea(area.id)}
                        className={`flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                        <span className="min-w-0 break-words">
                          {shortSearchAreaLabel(area.label)}
                        </span>
                      </button>
                    );
                  })}
                  {temporaryArea ? (
                    <div className="flex min-h-11 max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-3 pr-1 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 break-words">
                        {shortSearchAreaLabel(temporaryArea.label)}
                      </span>
                      <button
                        type="button"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-background/70"
                        onClick={() => setTemporaryArea(null)}
                        aria-label={`Ta bort ${temporaryArea.label} från sökningen`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  {!temporaryArea ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 rounded-full"
                      onClick={() => setShowOtherLocation((current) => !current)}
                      disabled={activeAreas.length >= MAX_SEARCH_CENTERS}
                    >
                      <Plus className="h-4 w-4" /> Annan plats
                    </Button>
                  ) : null}
                </div>
                {activeAreas.length >= MAX_SEARCH_CENTERS && !temporaryArea ? (
                  <p className="text-xs text-muted-foreground">
                    Avmarkera ett område för att söka på en annan plats samtidigt.
                  </p>
                ) : null}
              </div>

              {showOtherLocation && !temporaryArea ? (
                <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                  <Label htmlFor="temporary-area">Annan plats för den här sökningen</Label>
                  {isLive ? (
                    <GeoapifyLocationInput
                      id="temporary-area"
                      value={otherLocationText}
                      onChange={(text) => {
                        setOtherLocationText(text);
                        if (otherLocationCandidate && text !== otherLocationCandidate.label) {
                          setOtherLocationCandidate(null);
                        }
                      }}
                      onSelect={(value) => {
                        setOtherLocationText(value.label);
                        setOtherLocationCandidate({
                          id: `temporary-${value.placeId}`,
                          label: value.label,
                          lat: value.lat,
                          lng: value.lng,
                          provider: "geoapify",
                          placeId: value.placeId,
                        });
                      }}
                      onClearVerified={() => setOtherLocationCandidate(null)}
                      placeholder="Sök stad eller område"
                    />
                  ) : (
                    <Input
                      id="temporary-area"
                      value={otherLocationText}
                      onChange={(event) => setOtherLocationText(event.target.value)}
                      placeholder="t.ex. Majorna, Göteborg"
                    />
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => {
                        setShowOtherLocation(false);
                        setOtherLocationText("");
                        setOtherLocationCandidate(null);
                      }}
                    >
                      Avbryt
                    </Button>
                    <Button
                      type="button"
                      className="min-h-11"
                      onClick={useOtherLocation}
                      disabled={!otherLocationText.trim()}
                    >
                      Använd platsen
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeAreas.length === 0 ? (
                <Empty text="Välj minst ett sökområde eller lägg till en annan plats för den här sökningen." />
              ) : loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
                </div>
              ) : error ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="min-w-0 flex-1 text-destructive">{error}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Försök igen
                  </Button>
                </div>
              ) : (
                <>
                  {failedAreas.length > 0 ? (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                      Kunde inte söka i {failedAreas.join(", ")}. Övriga resultat visas.
                    </div>
                  ) : null}

                  {results.length === 0 ? (
                    <Empty text="Inga matställen hittades. Prova större radie, andra områden eller lägg till manuellt." />
                  ) : (
                    <>
                      <div className="lg:hidden">
                        <ResultToggle value={resultView} onChange={setResultView} />
                        <div className="mt-3">
                          {resultView === "lista" ? (
                            <ResultSections
                              available={availableResults}
                              existing={existingResults}
                              existingOpen={existingOpen}
                              onExistingOpenChange={setExistingOpen}
                              selectedId={selectedId}
                              onSelect={setSelectedId}
                              onAdd={beginAdd}
                              places={state.places}
                              disabled={isBusy}
                            />
                          ) : (
                            <MultiAreaPlaceMap
                              items={mapItems}
                              centers={activeAreas.map((area) => ({
                                id: area.id,
                                label: shortSearchAreaLabel(area.label),
                                lat: area.lat,
                                lng: area.lng,
                              }))}
                              radiusKm={radiusKm}
                              selectedId={selectedId}
                              onSelect={setSelectedId}
                              onAction={(item) => {
                                const result = availableResults.find(
                                  (candidate) => candidate.externalId === item.id,
                                );
                                if (result) beginAdd(result);
                              }}
                              className="h-[55vh] min-h-[340px]"
                            />
                          )}
                        </div>
                      </div>
                      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="max-h-[52vh] overflow-y-auto pr-1">
                          <ResultSections
                            available={availableResults}
                            existing={existingResults}
                            existingOpen={existingOpen}
                            onExistingOpenChange={setExistingOpen}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onAdd={beginAdd}
                            places={state.places}
                            disabled={isBusy}
                          />
                        </div>
                        <MultiAreaPlaceMap
                          items={mapItems}
                          centers={activeAreas.map((area) => ({
                            id: area.id,
                            label: shortSearchAreaLabel(area.label),
                            lat: area.lat,
                            lng: area.lng,
                          }))}
                          radiusKm={radiusKm}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onAction={(item) => {
                            const result = availableResults.find(
                              (candidate) => candidate.externalId === item.id,
                            );
                            if (result) beginAdd(result);
                          }}
                          className="h-[52vh] min-h-[390px]"
                        />
                      </div>
                      {unmappedCount > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          {unmappedCount} {unmappedCount === 1 ? "träff saknar" : "träffar saknar"}{" "}
                          kartposition och visas bara i listan.
                        </p>
                      ) : null}
                    </>
                  )}
                </>
              )}

              {addedResultIds.size > 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-sm" role="status">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {addedResultIds.size}{" "}
                  {addedResultIds.size === 1 ? "ställe tillagt" : "ställen tillagda"} i den här
                  omgången
                </div>
              ) : null}

              <p className="text-[11px] text-muted-foreground">
                {isLive
                  ? "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare."
                  : "Fiktiv demodata för utveckling."}
              </p>
            </div>
          ) : (
            <ManualForm value={manual} onChange={setManual} />
          )}

          <DialogFooter className="gap-2">
            <Button
              variant={tab === "sok" ? "default" : "ghost"}
              className="min-h-11"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              {tab === "sok" ? "Klar" : "Avbryt"}
            </Button>
            {tab === "manuell" ? (
              <Button
                className="min-h-11"
                disabled={isBusy || !primaryOccasion(manual.occasions)}
                onClick={submitManual}
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Lägg till
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open && pending != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closePending();
        }}
      >
        {pending ? (
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Lägg till i gruppen</DialogTitle>
              <DialogDescription>
                Kontrollera detaljerna och justera gruppens etiketter innan du lägger till stället.
              </DialogDescription>
            </DialogHeader>
            <PlaceSummary suggestion={pending} />
            <FoodTagMultiSelect
              id="pending-food-tags"
              value={pendingCuisines}
              onChange={setPendingCuisines}
              description="Förifyllt från platsinformationen. Du kan korrigera valen för gruppen."
            />
            <OccasionPicker
              id="pending-occasions"
              value={pendingOccasions}
              onChange={setPendingOccasions}
              required
            />
            <div className="space-y-1.5">
              <Label htmlFor="pending-notes">Anteckning till gruppen (frivilligt)</Label>
              <Textarea
                id="pending-notes"
                value={pendingNotes}
                onChange={(event) => setPendingNotes(event.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="min-h-11"
                disabled={isBusy}
                onClick={closePending}
              >
                <ArrowLeft className="h-4 w-4" /> Tillbaka
              </Button>
              <Button
                className="min-h-11"
                disabled={isBusy || !primaryOccasion(pendingOccasions)}
                onClick={confirmAdd}
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Lägg till i gruppen
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={open && syncOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeSync();
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Dela tidigare besök</DialogTitle>
            <DialogDescription>
              {syncVisits.length === 1
                ? `Du har ett tidigare besök på ${syncPlaceName} i en annan grupp.`
                : `Du har ${syncVisits.length} tidigare besök på ${syncPlaceName} i andra grupper.`}{" "}
              Välj vilka du vill dela till den här gruppen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Besöken länkas till den här gruppen. Medlemmarna här ser inte ursprungsgruppen eller
                privata kommentarer. Din egen kommentar delas bara om du väljer det.
              </p>
              <button
                type="button"
                onClick={() =>
                  setSyncVisitIds(
                    toggleAllSelection(
                      syncVisits.map((visit) => visit.visitId),
                      syncVisitIds,
                    ),
                  )
                }
                disabled={syncBusy}
                className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
              >
                {allSyncVisitsSelected ? "Rensa val" : "Välj alla"}
              </button>
            </div>
            <div className="space-y-2">
              {syncVisits.map((visit) => {
                const checked = syncVisitIds.includes(visit.visitId);
                return (
                  <label
                    key={visit.visitId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setSyncVisitIds((current) =>
                          current.includes(visit.visitId)
                            ? current.filter((id) => id !== visit.visitId)
                            : [...current, visit.visitId],
                        )
                      }
                      disabled={syncBusy}
                      aria-label={`Dela besöket från ${visit.groupName}`}
                    />
                    <span aria-hidden>{visit.groupEmoji ?? "🍽️"}</span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {visit.groupName}
                      <span className="block text-xs text-muted-foreground">
                        {formatOwnVisitDate(visit.visitedOn)} · {formatMealType(visit.mealType)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {syncVisits.some(
              (visit) => syncVisitIds.includes(visit.visitId) && visit.ownHasComment,
            ) ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
                <Label htmlFor="sync-share-comment" className="text-sm font-normal">
                  Dela även mina kommentarer
                </Label>
                <Switch
                  id="sync-share-comment"
                  checked={syncShareComment}
                  onCheckedChange={setSyncShareComment}
                  disabled={syncBusy}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="min-h-11" disabled={syncBusy} onClick={closeSync}>
              Hoppa över
            </Button>
            <Button
              className="min-h-11"
              disabled={syncBusy || syncVisitIds.length === 0}
              onClick={confirmSyncVisits}
            >
              {syncBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Dela valda besök
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResultSections({
  available,
  existing,
  existingOpen,
  onExistingOpenChange,
  selectedId,
  onSelect,
  onAdd,
  places,
  disabled,
}: {
  available: PlaceSuggestion[];
  existing: PlaceSuggestion[];
  existingOpen: boolean;
  onExistingOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (result: PlaceSuggestion) => void;
  places: Place[];
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Ställen att lägga till</h3>
        {available.length > 0 ? (
          available.map((result) => (
            <SuggestionRow
              key={result.externalId}
              result={result}
              selected={selectedId === result.externalId}
              onSelect={() => onSelect(result.externalId)}
              action={
                <Button
                  size="sm"
                  className="min-h-11 w-full shrink-0 sm:w-auto"
                  disabled={disabled}
                  onClick={() => onAdd(result)}
                >
                  <Plus className="h-4 w-4" /> Lägg till
                </Button>
              }
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Inga nya ställen i den här sökningen.
          </p>
        )}
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
              return (
                <SuggestionRow
                  key={result.externalId}
                  result={result}
                  selected={selectedId === result.externalId}
                  onSelect={() => onSelect(result.externalId)}
                  action={
                    place ? (
                      <Button asChild size="sm" variant="outline" className="min-h-11 w-full sm:w-auto">
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

function SuggestionRow({
  result,
  selected,
  onSelect,
  action,
}: {
  result: PlaceSuggestion;
  selected: boolean;
  onSelect: () => void;
  action: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center ${
        selected ? "border-primary/60 bg-primary/5" : "border-border/70"
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-xl">
          {emojiForCategory(result.category)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium">{result.name}</span>
          <span className="block break-words text-xs text-muted-foreground">
            {CATEGORY_LABEL[result.category]}
            {result.cuisines?.length ? ` · ${result.cuisines.join(", ")}` : ""}
          </span>
          <span className="block break-words text-[11px] text-muted-foreground">
            {result.area ? `${result.area} · ` : ""}
            {result.city}
            {result.distanceKm != null
              ? ` · ~${result.distanceKm} km${
                  result.nearestAreaLabel ? ` från ${result.nearestAreaLabel}` : ""
                }`
              : ""}
          </span>
          {result.address ? (
            <span className="block break-words text-[11px] text-muted-foreground">
              {result.address}
            </span>
          ) : null}
        </span>
      </button>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function ManualForm({
  value,
  onChange,
}: {
  value: ManualDraft;
  onChange: React.Dispatch<React.SetStateAction<ManualDraft>>;
}) {
  const set = <K extends keyof ManualDraft>(key: K, next: ManualDraft[K]) =>
    onChange((current) => ({ ...current, [key]: next }));
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="manual-name">Namn</Label>
          <Input
            id="manual-name"
            value={value.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </div>
        <EmojiPicker value={value.photo} onChange={(next) => set("photo", next)} />
      </div>
      <div className="space-y-1.5">
        <Label>Kategori</Label>
        <Select
          value={value.category}
          onValueChange={(next) => set("category", next as PlaceCategory)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FoodTagMultiSelect
        id="manual-food-tags"
        value={value.cuisines}
        onChange={(next) => set("cuisines", next)}
        description="Välj från Matrundans gemensamma lista för att undvika dubletter."
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="manual-address">Adress</Label>
          <Input
            id="manual-address"
            value={value.address}
            onChange={(event) => set("address", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-city">Stad</Label>
          <Input
            id="manual-city"
            value={value.city}
            onChange={(event) => set("city", event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manual-area">Område (valfritt)</Label>
        <Input
          id="manual-area"
          value={value.area}
          onChange={(event) => set("area", event.target.value)}
        />
      </div>
      <OccasionPicker
        id="manual-occasions"
        value={value.occasions}
        onChange={(occasions) => onChange((current) => ({ ...current, occasions }))}
        required
      />
      <div className="space-y-1.5">
        <Label htmlFor="manual-notes">Anteckning (frivilligt)</Label>
        <Textarea
          id="manual-notes"
          rows={2}
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </div>
    </div>
  );
}

function PlaceSummary({ suggestion }: { suggestion: PlaceSuggestion }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary text-2xl">
        {emojiForCategory(suggestion.category)}
      </div>
      <div className="min-w-0">
        <div className="break-words font-medium">{suggestion.name}</div>
        <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[suggestion.category]}</div>
        <div className="break-words text-[11px] text-muted-foreground">
          {suggestion.address}
          {suggestion.area ? ` · ${suggestion.area}` : ""} · {suggestion.city}
        </div>
      </div>
    </div>
  );
}

function TabToggle({ value, onChange }: { value: Tab; onChange: (value: Tab) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {(["sok", "manuell"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`min-h-11 rounded-full px-2 text-sm font-medium ${
            value === tab ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
        >
          {tab === "sok" ? "Sök & utforska" : "Lägg till manuellt"}
        </button>
      ))}
    </div>
  );
}

function ResultToggle({
  value,
  onChange,
}: {
  value: ResultView;
  onChange: (value: ResultView) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      <button
        type="button"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
          value === "lista" ? "bg-background shadow-sm" : "text-muted-foreground"
        }`}
        onClick={() => onChange("lista")}
        aria-pressed={value === "lista"}
      >
        <List className="h-4 w-4" /> Lista
      </button>
      <button
        type="button"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
          value === "karta" ? "bg-background shadow-sm" : "text-muted-foreground"
        }`}
        onClick={() => onChange("karta")}
        aria-pressed={value === "karta"}
      >
        <Map className="h-4 w-4" /> Karta
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

const EMOJIS = [
  "🍽️",
  "🍕",
  "🍣",
  "🍜",
  "🍔",
  "🌮",
  "☕",
  "🥐",
  "🍺",
  "🍦",
  "🥗",
  "🍷",
  "🥟",
  "🐟",
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-2xl"
        aria-label="Välj emoji"
        onClick={() => setOpen((current) => !current)}
      >
        {value}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 grid w-56 max-w-[calc(100vw-2rem)] grid-cols-7 gap-1 rounded-xl border border-border bg-popover p-2 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md p-1 text-xl hover:bg-accent"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function safeParse(raw?: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function emojiForCategory(category: PlaceCategory) {
  return {
    restaurang: "🍽️",
    café: "☕",
    bageri: "🥐",
    snabbmat: "🍔",
    pub: "🍺",
    matvagn: "🌭",
  }[category];
}
