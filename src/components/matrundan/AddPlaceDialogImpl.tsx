import * as React from "react";
import { ArrowLeft, Check, List, Loader2, Map, Plus, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "@/components/matrundan/FoodTagMultiSelect";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";
import { OccasionPicker } from "@/components/matrundan/OccasionPicker";
import { PlaceMap } from "@/components/matrundan/PlaceMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { geoapifySearchPlaces } from "@/lib/matrundan/geoapify.functions";
import { formatLocation, parseLocation } from "@/lib/matrundan/location";
import {
  listOwnVisitsForPlaceOnAdd,
  shareVisitToGroup,
  type OwnVisitForPlace,
} from "@/lib/matrundan/live-sharing";
import { primaryOccasion } from "@/lib/matrundan/occasions";
import { getPlacesProvider, type PlaceSuggestion } from "@/lib/matrundan/places-provider";
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
} from "@/lib/matrundan/types";

const RADIUS_OPTIONS = [1, 3, 5, 10, 25, 50] as const;

type ResultView = "lista" | "karta";
type Tab = "sok" | "manuell";
type ResultStatus = "available" | "archived" | "added" | "existing";

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

function toServerRadius(value: number): 1 | 3 | 5 | 10 | 25 | null {
  return value === 1 || value === 3 || value === 5 || value === 10 || value === 25 ? value : null;
}

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

function resultStatusText(status: ResultStatus) {
  if (status === "added") return "Tillagd";
  if (status === "existing") return "Finns redan";
  if (status === "archived") return "Kan läggas tillbaka";
  return null;
}

export function AddPlaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, addPlace, addProviderPlace, submitting } = useStore();
  const { mode, activeGroupId } = useSession();
  const isLive = mode === "live";
  const home = state.group.homeLocation;
  const verifiedHome =
    isLive && home?.verified && home.lat != null && home.lng != null
      ? { label: home.label, lat: home.lat, lng: home.lng }
      : null;

  const [tab, setTab] = React.useState<Tab>("sok");
  const [query, setQuery] = React.useState("");
  const [location, setLocation] = React.useState(
    isLive ? (verifiedHome?.label ?? "") : state.group.city,
  );
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(
    verifiedHome ? { lat: verifiedHome.lat, lng: verifiedHome.lng } : null,
  );
  const [centerLabel, setCenterLabel] = React.useState(verifiedHome?.label ?? "");
  const [radiusKm, setRadiusKm] = React.useState(1);
  const [results, setResults] = React.useState<PlaceSuggestion[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [resultView, setResultView] = React.useState<ResultView>("lista");
  const [pending, setPending] = React.useState<PlaceSuggestion | null>(null);
  const [pendingCuisines, setPendingCuisines] = React.useState<string[]>([]);
  const [pendingOccasions, setPendingOccasions] = React.useState<Occasion[]>([]);
  const [pendingNotes, setPendingNotes] = React.useState("");
  const [manual, setManual] = React.useState<ManualDraft>(() => emptyManual(state.group.city));
  const [addedResultIds, setAddedResultIds] = React.useState<Set<string>>(() => new Set());
  const [existingResultIds, setExistingResultIds] = React.useState<Set<string>>(() => new Set());
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

  const parsed = React.useMemo(
    () => parseLocation(location, isLive ? "" : state.group.city),
    [isLive, location, state.group.city],
  );
  const validLocation = isLive
    ? !!center && centerLabel.trim() === location.trim()
    : parsed.city.trim().length > 0;

  const reset = React.useCallback(() => {
    setTab("sok");
    setQuery("");
    setLocation(isLive ? (verifiedHome?.label ?? "") : state.group.city);
    setCenter(verifiedHome ? { lat: verifiedHome.lat, lng: verifiedHome.lng } : null);
    setCenterLabel(verifiedHome?.label ?? "");
    setRadiusKm(1);
    setResults([]);
    setSelectedId(null);
    setResultView("lista");
    setPending(null);
    setPendingCuisines([]);
    setPendingOccasions([]);
    setPendingNotes("");
    setManual(emptyManual(state.group.city));
    setAddedResultIds(new Set());
    setExistingResultIds(new Set());
    setError(null);
    setRetry(0);
    setSyncOpen(false);
    setSyncPlaceName("");
    setSyncVisits([]);
    setSyncVisitIds([]);
    setSyncShareComment(false);
    setSyncBusy(false);
  }, [isLive, state.group.city, verifiedHome]);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  React.useEffect(() => {
    if (centerLabel && location.trim() !== centerLabel.trim()) {
      setCenter(null);
      setCenterLabel("");
      setResults([]);
    }
  }, [centerLabel, location]);

  React.useEffect(() => {
    if (!open || tab !== "sok" || !validLocation) return;
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const nextResults = isLive
          ? await geoapifySearchPlaces({
              data: {
                text: query.trim() || undefined,
                lat: center!.lat,
                lng: center!.lng,
                radiusKm: toServerRadius(radiusKm),
                limit: 25,
              },
            }).then((rows) =>
              rows.map((row) => ({
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
              })),
            )
          : await getPlacesProvider().search({
              query: query.trim() || undefined,
              city: parsed.city,
              area: parsed.area,
              radiusKm: toServerRadius(radiusKm),
            });
        if (requestId !== requestRef.current) return;
        setResults(nextResults);
        setSelectedId(
          nextResults.find((result) => result.lat != null && result.lng != null)?.externalId ??
            null,
        );
      } catch (caught) {
        if (requestId !== requestRef.current) return;
        setResults([]);
        setError(providerMessage(caught));
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [center, isLive, open, parsed.area, parsed.city, query, radiusKm, retry, tab, validLocation]);

  const statusForResult = React.useCallback(
    (suggestion: PlaceSuggestion): ResultStatus => {
      if (addedResultIds.has(suggestion.externalId)) return "added";
      if (existingResultIds.has(suggestion.externalId)) return "existing";
      const match = matchingPlace(state.places, suggestion);
      if (!match) return "available";
      return match.collectionStatus === "archived" ? "archived" : "existing";
    },
    [addedResultIds, existingResultIds, state.places],
  );

  const beginAdd = (suggestion: PlaceSuggestion) => {
    const status = statusForResult(suggestion);
    if (status === "added") {
      toast.info("Stället är redan tillagt i den här omgången.");
      return;
    }
    if (status === "existing") {
      toast.info("Det här stället finns redan i gruppen.");
      return;
    }
    setSelectedId(suggestion.externalId);
    setPending(suggestion);
    setPendingCuisines(suggestion.cuisines ?? []);
    setPendingOccasions([]);
    setPendingNotes("");
  };

  const closePending = () => {
    if (isBusy) return;
    setPending(null);
    setPendingCuisines([]);
    setPendingOccasions([]);
    setPendingNotes("");
  };

  const closeSync = () => {
    if (syncBusy) return;
    setSyncOpen(false);
    setSyncPlaceName("");
    setSyncVisits([]);
    setSyncVisitIds([]);
    setSyncShareComment(false);
  };

  const confirmAdd = async () => {
    if (!pending || isBusy) return;
    const statusBefore = statusForResult(pending);
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
      setExistingResultIds((current) => {
        const next = new Set(current);
        next.delete(pending.externalId);
        return next;
      });
      setPending(null);
      setPendingCuisines([]);
      setPendingOccasions([]);
      setPendingNotes("");

      toast.success(
        statusBefore === "archived"
          ? `${added.name} är tillbaka i gruppens lista`
          : `${added.name} tillagd i gruppen`,
      );

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
        setExistingResultIds((current) => new Set(current).add(pending.externalId));
        setPending(null);
        toast.info("Det här stället finns redan i gruppen.");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmSyncVisits = async () => {
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
    setSyncOpen(false);
    setSyncPlaceName("");
    setSyncVisits([]);
    setSyncVisitIds([]);
    setSyncShareComment(false);
    toast.success(
      `${successfulIds.length} ${successfulIds.length === 1 ? "besök delat" : "besök delade"} till gruppen`,
    );
  };

  const submitManual = async () => {
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
  };

  const locationLabel = isLive ? centerLabel || "Välj område" : formatLocation(parsed);
  const mapItems = results.map((result) => {
    const status = statusForResult(result);
    const statusText = resultStatusText(status);
    return {
      id: result.externalId,
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      eyebrow: [
        `${CATEGORY_LABEL[result.category]}${result.distanceKm != null ? ` · ~${result.distanceKm} km` : ""}`,
        statusText,
      ]
        .filter(Boolean)
        .join(" · "),
      description: [result.address, result.area, result.city].filter(Boolean).join(" · "),
    };
  });
  const unmappedCount = results.filter((result) => result.lat == null || result.lng == null).length;
  const addedCount = addedResultIds.size;
  const pendingStatus = pending ? statusForResult(pending) : "available";
  const restoringPending = pendingStatus === "archived";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Lägg till matställe</DialogTitle>
            <DialogDescription>
              Utforska ett område eller lägg till manuellt. Området är bara ett sökförslag.
            </DialogDescription>
          </DialogHeader>

          <TabToggle value={tab} onChange={setTab} />

          {tab === "sok" ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
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
                  <Label htmlFor="place-location">Plats</Label>
                  {isLive ? (
                    <GeoapifyLocationInput
                      id="place-location"
                      value={location}
                      onChange={setLocation}
                      onSelect={(value) => {
                        setLocation(value.label);
                        setCenterLabel(value.label);
                        setCenter({ lat: value.lat, lng: value.lng });
                      }}
                      onClearVerified={() => {
                        setCenter(null);
                        setCenterLabel("");
                        setResults([]);
                      }}
                      placeholder="Sök stad eller område"
                      ariaInvalid={!validLocation}
                    />
                  ) : (
                    <Input
                      id="place-location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="Område, stad"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Sökradie</Label>
                  <Select
                    value={String(radiusKm)}
                    onValueChange={(value) => setRadiusKm(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RADIUS_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value === 50 ? "Större område · inom 50 km" : `Inom ${value} km`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                {locationLabel} · inom {radiusKm} km
              </div>

              {addedCount > 0 ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-sm"
                >
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {addedCount} {addedCount === 1 ? "ställe tillagt" : "ställen tillagda"} i den
                    här omgången
                  </span>
                </div>
              ) : null}

              {error ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="min-w-0 flex-1 text-destructive">{error}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    <RefreshCcw className="h-4 w-4" /> Försök igen
                  </Button>
                </div>
              ) : null}

              {!validLocation ? (
                <Empty
                  text={
                    isLive
                      ? "Välj ett område i listan för att börja utforska."
                      : "Ange en stad för att börja utforska."
                  }
                />
              ) : loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
                </div>
              ) : results.length === 0 && !error ? (
                <Empty text="Inga matställen hittades. Prova ett bredare område eller lägg till manuellt." />
              ) : results.length > 0 ? (
                <>
                  <div className="lg:hidden">
                    <ResultToggle value={resultView} onChange={setResultView} />
                    <div className="mt-3">
                      {resultView === "lista" ? (
                        <SuggestionList
                          results={results}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onAdd={beginAdd}
                          statusFor={statusForResult}
                          disabled={isBusy}
                        />
                      ) : (
                        <ResultsMap
                          results={results}
                          items={mapItems}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onAdd={beginAdd}
                          statusFor={statusForResult}
                          center={isLive ? center : null}
                          radiusKm={isLive ? radiusKm : null}
                        />
                      )}
                    </div>
                  </div>
                  <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="max-h-[52vh] overflow-y-auto pr-1">
                      <SuggestionList
                        results={results}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onAdd={beginAdd}
                        statusFor={statusForResult}
                        disabled={isBusy}
                      />
                    </div>
                    <ResultsMap
                      results={results}
                      items={mapItems}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onAdd={beginAdd}
                      statusFor={statusForResult}
                      center={isLive ? center : null}
                      radiusKm={isLive ? radiusKm : null}
                    />
                  </div>
                  {unmappedCount > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {unmappedCount} {unmappedCount === 1 ? "träff saknar" : "träffar saknar"}{" "}
                      kartposition och visas bara i listan.
                    </p>
                  ) : null}
                </>
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
              <DialogTitle className="font-display text-2xl">
                {restoringPending ? "Lägg tillbaka i gruppen" : "Lägg till i gruppen"}
              </DialogTitle>
              <DialogDescription>
                {restoringPending
                  ? "Stället har funnits i gruppen tidigare. Kontrollera detaljerna innan det läggs tillbaka."
                  : "Kontrollera detaljerna och justera gruppens etiketter innan du lägger till stället."}
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
              <Button variant="ghost" className="min-h-11" disabled={isBusy} onClick={closePending}>
                <ArrowLeft className="h-4 w-4" /> Tillbaka
              </Button>
              <Button
                className="min-h-11"
                disabled={isBusy || !primaryOccasion(pendingOccasions)}
                onClick={confirmAdd}
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {restoringPending ? "Lägg tillbaka i gruppen" : "Lägg till i gruppen"}
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

function ResultsMap({
  results,
  items,
  selectedId,
  onSelect,
  onAdd,
  statusFor,
  center,
  radiusKm,
}: {
  results: PlaceSuggestion[];
  items: {
    id: string;
    name: string;
    lat?: number;
    lng?: number;
    eyebrow: string;
    description: string;
  }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (result: PlaceSuggestion) => void;
  statusFor: (result: PlaceSuggestion) => ResultStatus;
  center: { lat: number; lng: number } | null;
  radiusKm: number | null;
}) {
  const selectedResult =
    results.find((candidate) => candidate.externalId === selectedId) ?? results[0] ?? null;
  const selectedStatus = selectedResult ? statusFor(selectedResult) : "available";
  const actionable = selectedStatus === "available" || selectedStatus === "archived";

  return (
    <PlaceMap
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      onAction={
        actionable
          ? (item) => {
              const result = results.find((candidate) => candidate.externalId === item.id);
              if (result) onAdd(result);
            }
          : undefined
      }
      actionLabel={selectedStatus === "archived" ? "Lägg tillbaka" : "Lägg till"}
      center={center}
      radiusKm={radiusKm}
      className="h-[55vh] min-h-[340px] lg:h-[52vh] lg:min-h-[390px]"
      ariaLabel="Karta över sökresultat"
    />
  );
}

function SuggestionList({
  results,
  selectedId,
  onSelect,
  onAdd,
  statusFor,
  disabled,
}: {
  results: PlaceSuggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (result: PlaceSuggestion) => void;
  statusFor: (result: PlaceSuggestion) => ResultStatus;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {results.map((result) => {
        const status = statusFor(result);
        const actionable = status === "available" || status === "archived";
        const label =
          status === "added"
            ? "Tillagd"
            : status === "existing"
              ? "Finns redan"
              : status === "archived"
                ? "Lägg tillbaka"
                : "Lägg till";
        const Icon =
          status === "added" || status === "existing"
            ? Check
            : status === "archived"
              ? RefreshCcw
              : Plus;

        return (
          <div
            key={result.externalId}
            className={`flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center ${selectedId === result.externalId ? "border-primary/60 bg-primary/5" : "border-border/70"}`}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(result.externalId)}
              aria-pressed={selectedId === result.externalId}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-xl">
                {emojiForCategory(result.category)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{result.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {CATEGORY_LABEL[result.category]}
                  {result.cuisines?.length ? ` · ${result.cuisines.join(", ")}` : ""}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {result.area ? `${result.area} · ` : ""}
                  {result.city}
                  {result.distanceKm != null ? ` · ~${result.distanceKm} km` : ""}
                </span>
                {result.address ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {result.address}
                  </span>
                ) : null}
              </span>
            </button>
            <Button
              size="sm"
              variant={actionable ? "default" : "secondary"}
              className="min-h-11 w-full shrink-0 sm:w-auto"
              disabled={disabled || !actionable}
              onClick={() => onAdd(result)}
            >
              <Icon className="h-4 w-4" /> {label}
            </Button>
          </div>
        );
      })}
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
        onChange={(occasions) =>
          onChange((current) => ({
            ...current,
            occasions,
          }))
        }
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
        <div className="truncate font-medium">{suggestion.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {CATEGORY_LABEL[suggestion.category]}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
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
          className={`min-h-11 rounded-full px-2 text-sm font-medium ${value === tab ? "bg-background shadow-sm" : "text-muted-foreground"}`}
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
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${value === "lista" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        onClick={() => onChange("lista")}
        aria-pressed={value === "lista"}
      >
        <List className="h-4 w-4" /> Lista
      </button>
      <button
        type="button"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${value === "karta" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
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

const EMOJIS = ["🍽️", "🍕", "🍣", "🍜", "🍔", "🌮", "☕", "🥐", "🍺", "🍦", "🥗", "🍷", "🥟", "🐟"];

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
