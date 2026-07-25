import * as React from "react";
import { Search, Loader2, Plus, ArrowLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_LABEL,
  OCCASION_LABEL,
  type Occasion,
  type PlaceCategory,
} from "@/lib/matrundan/types";
import { useStore } from "@/lib/matrundan/store";
import { useSession } from "@/lib/matrundan/session";
import {
  getPlacesProvider,
  type PlaceSuggestion,
} from "@/lib/matrundan/places-provider";
import {
  geoapifyAutocompleteLocation,
  geoapifySearchPlaces,
} from "@/lib/matrundan/geoapify.functions";
import { parseLocation, formatLocation } from "@/lib/matrundan/location";

const OCCASIONS: Occasion[] = ["snabbt", "avslappnat", "middag"];

/**
 * Sökradieval. Server-funktionen tillåter 1/3/5/10/25 km eller `null` (som
 * i sin tur mappas till en avgränsad ~50 km-cirkel runt centrum – inte
 * verklig rikstäckning). Vi speglar det i UI:t med "Större område · inom
 * 50 km" istället för den missvisande "Hela landet".
 */
const RADIUS_OPTIONS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Inom 1 km", short: "inom 1 km" },
  { value: 3, label: "Inom 3 km", short: "inom 3 km" },
  { value: 5, label: "Inom 5 km", short: "inom 5 km" },
  { value: 10, label: "Inom 10 km", short: "inom 10 km" },
  { value: 25, label: "Inom 25 km", short: "inom 25 km" },
  { value: 50, label: "Större område · inom 50 km", short: "inom 50 km" },
];
const DEFAULT_RADIUS = 5;

/** Server accepterar 1/3/5/10/25 eller null. 50 skickas som null. */
function toServerRadius(km: number): 1 | 3 | 5 | 10 | 25 | null {
  if (km === 1 || km === 3 || km === 5 || km === 10 || km === 25) return km;
  return null;
}

type LocationSuggestion = {
  label: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
};

type ProviderError = {
  message: string;
  code?: string;
  retryable: boolean;
};

function classifyError(e: unknown): ProviderError {
  const err = e as Error & { code?: string };
  const msg = err?.message ?? "Kunde inte hämta förslag.";
  // Server kastar strängar med prefix – tolka rimligt.
  if (/GEOAPIFY_NOT_CONFIGURED/i.test(msg) || err?.code === "geoapify_not_configured") {
    return {
      message:
        "Platssökningen är ännu inte aktiverad på servern. Använd fliken Lägg till manuellt tills nyckeln finns på plats.",
      code: "not_configured",
      retryable: false,
    };
  }
  if (/GEOAPIFY_RATE_LIMIT/i.test(msg)) {
    return {
      message: "Sökningen används mycket just nu. Vänta en stund och försök igen.",
      code: "rate_limit",
      retryable: true,
    };
  }
  if (/GEOAPIFY_CONFIG_ERROR/i.test(msg)) {
    return {
      message: "Platssökningen är felkonfigurerad på servern. Testa manuellt tills det är åtgärdat.",
      code: "config_error",
      retryable: false,
    };
  }
  if (/GEOAPIFY_TIMEOUT/i.test(msg)) {
    return {
      message: "Sökningen tog för lång tid. Försök igen.",
      code: "timeout",
      retryable: true,
    };
  }
  if (/GEOAPIFY_UNAVAILABLE|GEOAPIFY_MALFORMED|network|fetch/i.test(msg)) {
    return {
      message: "Kunde inte nå platstjänsten just nu. Försök igen strax.",
      code: "network",
      retryable: true,
    };
  }
  return { message: msg, retryable: true };
}

export function AddPlaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addPlace, addProviderPlace, state, submitting } = useStore();
  const { mode } = useSession();
  const isLive = mode === "live";
  const [busy, setBusy] = React.useState(false);
  const isBusy = busy || submitting;
  const [tab, setTab] = React.useState<"sok" | "manuell">("sok");
  const [providerError, setProviderError] = React.useState<ProviderError | null>(null);

  // sök & utforska
  const [query, setQuery] = React.useState("");
  const [location, setLocation] = React.useState(state.group.city);
  const [radiusKm, setRadiusKm] = React.useState<number>(DEFAULT_RADIUS);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<PlaceSuggestion[]>([]);
  /** Bumpas av Retry-knappen för att verkligen köra om sökeffekten. */
  const [retryNonce, setRetryNonce] = React.useState(0);

  // Live-läge: cachea koordinaterna för Plats-texten så vi inte
  // geokodar på varje tangenttryck och för att kunna filtrera på radie.
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(null);
  const [centerLabel, setCenterLabel] = React.useState<string>("");
  const [locationSuggestions, setLocationSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [showLocationSuggest, setShowLocationSuggest] = React.useState(false);
  const [locationActiveIx, setLocationActiveIx] = React.useState(-1);
  const [locationLoading, setLocationLoading] = React.useState(false);
  /** Sant när senaste autocomplete-anropet är klart (oavsett antal träffar). */
  const [locationRequestDone, setLocationRequestDone] = React.useState(false);

  // Race-protection: räknare per svar-typ; vi accepterar bara det senaste.
  const locationReqRef = React.useRef(0);
  const searchReqRef = React.useRef(0);
  /** ExternalId för sökresultatets knapp som öppnade bekräftelsesteget – används för att återställa fokus vid Tillbaka. */
  const [focusReturnId, setFocusReturnId] = React.useState<string | null>(null);

  // Bekräftelsesteget: användaren har valt ett förslag, väljer occasions
  // och anteckning innan riktig save körs.
  const [pending, setPending] = React.useState<PlaceSuggestion | null>(null);
  const [pendingOccasions, setPendingOccasions] = React.useState<Occasion[]>([
    "avslappnat",
  ]);
  const [pendingNotes, setPendingNotes] = React.useState("");

  const parsed = React.useMemo(
    () => parseLocation(location, state.group.city),
    [location, state.group.city],
  );

  // manuellt
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<PlaceCategory>("restaurang");
  const [cuisines, setCuisines] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [manualArea, setManualArea] = React.useState("");
  const [city, setCity] = React.useState(state.group.city);
  const [occasions, setOccasions] = React.useState<Occasion[]>(["avslappnat"]);
  const [notes, setNotes] = React.useState("");
  const [photo, setPhoto] = React.useState("🍽️");

  const resetAll = React.useCallback(() => {
    setQuery("");
    setLocation(state.group.city);
    setRadiusKm(DEFAULT_RADIUS);
    setResults([]);
    setCenter(null);
    setCenterLabel("");
    setLocationSuggestions([]);
    setShowLocationSuggest(false);
    setLocationActiveIx(-1);
    setLocationRequestDone(false);
    setProviderError(null);
    setPending(null);
    setPendingOccasions(["avslappnat"]);
    setPendingNotes("");
    setFocusReturnId(null);
    setRetryNonce(0);
    setName("");
    setAddress("");
    setManualArea("");
    setCuisines("");
    setNotes("");
    setOccasions(["avslappnat"]);
    setCategory("restaurang");
    setPhoto("🍽️");
    setTab("sok");
  }, [state.group.city]);

  React.useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  const cityValid = parsed.city.trim().length > 0;

  // När användaren skriver om platsen manuellt: invalidera centrum om
  // texten inte längre motsvarar det senast valda förslaget.
  React.useEffect(() => {
    if (centerLabel && location.trim() !== centerLabel) {
      setCenter(null);
      setCenterLabel("");
    }
  }, [location, centerLabel]);

  // Live-läge: autocomplete-förslag för Plats-fältet (debounce 300 ms).
  React.useEffect(() => {
    if (!isLive || !open || tab !== "sok" || pending) return;
    const text = location.trim();
    if (text.length < 2) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      return;
    }
    const reqId = ++locationReqRef.current;
    setLocationLoading(true);
    const t = setTimeout(() => {
      geoapifyAutocompleteLocation({
        data: {
          text,
          limit: 6,
          biasLat: center?.lat,
          biasLng: center?.lng,
        },
      })
        .then((rows) => {
          if (reqId !== locationReqRef.current) return;
          setLocationSuggestions(rows);
          setLocationActiveIx(-1);
          setLocationLoading(false);
        })
        .catch((e: unknown) => {
          if (reqId !== locationReqRef.current) return;
          setLocationSuggestions([]);
          setLocationLoading(false);
          const pe = classifyError(e);
          if (pe.code === "not_configured" || pe.code === "config_error") {
            setProviderError(pe);
          }
        });
    }, 300);
    return () => clearTimeout(t);
  }, [isLive, open, tab, location, center, pending]);

  // Sök-effekten: demo eller live beroende på läge.
  React.useEffect(() => {
    if (tab !== "sok" || !open || !cityValid || pending) {
      if (!cityValid) setResults([]);
      return;
    }
    const reqId = ++searchReqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (isLive) {
          let c = center;
          const targetLabel = formatLocation(parsed);
          if (!c || centerLabel !== targetLabel) {
            const rows = await geoapifyAutocompleteLocation({
              data: { text: targetLabel, limit: 1 },
            });
            if (reqId !== searchReqRef.current) return;
            const first = rows[0];
            if (!first || first.lat == null || first.lng == null) {
              setResults([]);
              setProviderError({
                message: `Hittade ingen plats för “${targetLabel}”. Försök skriva mer exakt eller välj ett förslag i listan.`,
                retryable: false,
              });
              setLoading(false);
              return;
            }
            c = { lat: first.lat, lng: first.lng };
            setCenter(c);
            setCenterLabel(targetLabel);
          }
          const rows = await geoapifySearchPlaces({
            data: {
              text: query.trim() || undefined,
              lat: c.lat,
              lng: c.lng,
              radiusKm: toServerRadius(radiusKm),
              limit: 25,
            },
          });
          if (reqId !== searchReqRef.current) return;
          const mapped: PlaceSuggestion[] = rows.map((r) => ({
            externalId: r.externalId,
            provider: r.provider,
            name: r.name,
            category: r.category,
            cuisines: r.cuisines,
            address: r.address,
            city: r.city,
            area: r.area,
            lat: r.lat,
            lng: r.lng,
            distanceKm: r.distanceKm,
            raw: r.raw,
          }));
          setResults(mapped);
          setProviderError(null);
        } else {
          const r = await getPlacesProvider().search({
            query: query.trim() || undefined,
            city: parsed.city,
            area: parsed.area,
            radiusKm: toServerRadius(radiusKm),
          });
          if (reqId !== searchReqRef.current) return;
          setResults(r);
          setProviderError(null);
        }
      } catch (e) {
        if (reqId !== searchReqRef.current) return;
        setResults([]);
        setProviderError(classifyError(e));
      } finally {
        if (reqId === searchReqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [
    query,
    parsed.city,
    parsed.area,
    radiusKm,
    tab,
    open,
    cityValid,
    isLive,
    center,
    centerLabel,
    parsed,
    pending,
  ]);

  const openConfirm = (s: PlaceSuggestion) => {
    if (isBusy) return;
    setPending(s);
    setPendingOccasions(["avslappnat"]);
    setPendingNotes("");
  };

  const confirmAdd = async () => {
    if (!pending || isBusy) return;
    setBusy(true);
    try {
      const base = {
        name: pending.name,
        category: pending.category,
        cuisines: pending.cuisines ?? [],
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
      const p =
        isLive && pending.provider && pending.provider !== "demo"
          ? await addProviderPlace({
              provider: pending.provider,
              providerPlaceId: pending.externalId,
              place: base,
              raw: pending.raw ? safeParse(pending.raw) : {},
            })
          : await addPlace(base);
      toast.success(`${p.name} tillagd`);
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message || "Kunde inte lägga till stället.";
      if (/redan|already|duplicate|unique/i.test(msg)) {
        toast.info("Det här stället finns redan i gruppen.");
        onOpenChange(false);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const filterSummary = `${formatLocation(parsed)} · ${radiusSummary(radiusKm)}`;

  const onLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLive) return;
    if (!showLocationSuggest || locationSuggestions.length === 0) {
      if (e.key === "ArrowDown" && locationSuggestions.length > 0) {
        setShowLocationSuggest(true);
        setLocationActiveIx(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setLocationActiveIx((ix) => (ix + 1) % locationSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setLocationActiveIx((ix) =>
        ix <= 0 ? locationSuggestions.length - 1 : ix - 1,
      );
    } else if (e.key === "Enter") {
      if (locationActiveIx >= 0) {
        e.preventDefault();
        applyLocationSuggestion(locationSuggestions[locationActiveIx]);
      }
    } else if (e.key === "Escape") {
      setShowLocationSuggest(false);
      setLocationActiveIx(-1);
    }
  };

  const applyLocationSuggestion = (s: LocationSuggestion) => {
    const text = s.area ? `${s.area}, ${s.city}` : s.city;
    setLocation(text);
    if (s.lat != null && s.lng != null) {
      setCenter({ lat: s.lat, lng: s.lng });
      setCenterLabel(text);
    }
    setShowLocationSuggest(false);
    setLocationActiveIx(-1);
  };

  const submitManual = async () => {
    if (isBusy) return;
    if (!name.trim()) {
      toast.error("Ge stället ett namn");
      return;
    }
    setBusy(true);
    try {
      const p = await addPlace({
        name: name.trim(),
        category,
        cuisines: cuisines
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        occasions,
        address: address.trim(),
        area: manualArea.trim() || undefined,
        city: city.trim() || state.group.city,
        addedBy: state.currentUserId,
        notes: notes.trim() || undefined,
        photo,
      });
      toast.success(`${p.name} tillagd`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Kunde inte lägga till stället.");
    } finally {
      setBusy(false);
    }
  };

  // === Bekräftelsesteg ===
  if (pending) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Lägg till i gruppen
            </DialogTitle>
            <DialogDescription>
              Kontrollera detaljerna innan du lägger till stället.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary text-2xl">
                {emojiForCategory(pending.category)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{pending.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {CATEGORY_LABEL[pending.category]}
                  {pending.cuisines?.length
                    ? ` · ${pending.cuisines.join(", ")}`
                    : ""}
                </div>
                {pending.address ? (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {pending.address}
                  </div>
                ) : null}
                <div className="truncate text-[11px] text-muted-foreground">
                  {pending.area ? `${pending.area} · ` : ""}
                  {pending.city}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Passar för</Label>
            <p className="text-[11px] text-muted-foreground">
              Välj situation – flera går bra. Avslappnat är förvalt, ändra fritt.
            </p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => {
                const active = pendingOccasions.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setPendingOccasions((cur) =>
                        active ? cur.filter((x) => x !== o) : [...cur, o],
                      )
                    }
                    className="min-h-11"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer rounded-full px-3 py-1 text-xs"
                    >
                      {OCCASION_LABEL[o]}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pending-notes">Anteckning till gruppen (frivilligt)</Label>
            <Textarea
              id="pending-notes"
              value={pendingNotes}
              onChange={(e) => setPendingNotes(e.target.value)}
              placeholder="T.ex. deras surdegspizza är otrolig…"
              rows={2}
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setPending(null)}
              disabled={isBusy}
              className="min-h-11"
            >
              <ArrowLeft className="h-4 w-4" /> Tillbaka
            </Button>
            <Button
              onClick={confirmAdd}
              disabled={isBusy || pendingOccasions.length === 0}
              className="min-h-11"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lägg till i gruppen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // === Huvudvy: Sök eller Manuell ===
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Lägg till matställe
          </DialogTitle>
          <DialogDescription>
            Utforska ett område eller lägg till manuellt. Ett ställe får ligga var
            som helst – området är bara ett sökförslag.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          {(["sok", "manuell"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={[
                "min-h-11 rounded-full py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              {t === "sok" ? "Sök & utforska" : "Lägg till manuellt"}
            </button>
          ))}
        </div>

        {tab === "sok" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="q">Vad är du sugen på?</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="q"
                  placeholder="Namn, kök eller kategori (valfritt)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s-location">Plats</Label>
              <div className="relative">
                <Input
                  id="s-location"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setShowLocationSuggest(true);
                  }}
                  onFocus={() => setShowLocationSuggest(true)}
                  onBlur={() =>
                    setTimeout(() => setShowLocationSuggest(false), 150)
                  }
                  onKeyDown={onLocationKeyDown}
                  placeholder="Stad, eller ”Område, Stad” (t.ex. Haga, Göteborg)"
                  aria-invalid={!cityValid}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={
                    isLive && showLocationSuggest && locationSuggestions.length > 0
                  }
                  aria-controls="location-listbox"
                  aria-activedescendant={
                    locationActiveIx >= 0
                      ? `location-opt-${locationActiveIx}`
                      : undefined
                  }
                />
                {isLive &&
                showLocationSuggest &&
                (locationSuggestions.length > 0 || locationLoading) ? (
                  <ul
                    id="location-listbox"
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
                  >
                    {locationLoading && locationSuggestions.length === 0 ? (
                      <li className="px-2 py-2 text-muted-foreground">Söker…</li>
                    ) : locationSuggestions.length === 0 ? (
                      <li className="px-2 py-2 text-muted-foreground">
                        Inga träffar
                      </li>
                    ) : (
                      locationSuggestions.map((s, i) => (
                        <li
                          key={`${s.label}-${i}`}
                          id={`location-opt-${i}`}
                          role="option"
                          aria-selected={i === locationActiveIx}
                        >
                          <button
                            type="button"
                            className={[
                              "w-full rounded px-2 py-1.5 text-left hover:bg-accent",
                              i === locationActiveIx ? "bg-accent" : "",
                            ].join(" ")}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applyLocationSuggestion(s);
                            }}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Söker i {formatLocation(parsed)}. Skriv med komma för att peka
                ut ett område.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Sökradie</Label>
              <Select
                value={String(radiusKm)}
                onValueChange={(v) => setRadiusKm(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
              <span className="truncate text-muted-foreground">
                {filterSummary}
              </span>
            </div>

            {providerError ? (
              <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="text-destructive">{providerError.message}</p>
                <div className="flex flex-wrap gap-2">
                  {providerError.retryable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setProviderError(null);
                        // Trigga om-sök genom att bumpa en dummy-effekt via query-state.
                        setQuery((q) => q);
                        searchReqRef.current++;
                        setLoading(true);
                        setTimeout(() => setLoading(false), 0);
                      }}
                      className="min-h-11"
                    >
                      <RefreshCcw className="h-4 w-4" /> Försök igen
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTab("manuell")}
                    className="min-h-11"
                  >
                    Lägg till manuellt
                  </Button>
                </div>
              </div>
            ) : null}

            {!cityValid ? (
              <EmptyBlock text="Ange en stad för att börja utforska." />
            ) : loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
              </div>
            ) : results.length === 0 && !providerError ? (
              <EmptyBlock
                text={
                  query.trim()
                    ? `Inga träffar för “${query.trim()}” ${radiusSummary(radiusKm)} i ${formatLocation(parsed)}. Prova ett bredare område eller lägg till manuellt.`
                    : `Inga matställen hittades ${radiusSummary(radiusKm)} i ${formatLocation(parsed)}. Prova ett bredare område.`
                }
              />
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((r) => (
                  <div
                    key={r.externalId}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-xl">
                      {emojiForCategory(r.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {CATEGORY_LABEL[r.category]}
                        {r.cuisines?.length ? ` · ${r.cuisines.join(", ")}` : ""}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.area ? `${r.area} · ` : ""}
                        {r.city}
                        {r.distanceKm != null ? ` · ~${r.distanceKm} km` : ""}
                      </div>
                      {r.address ? (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {r.address}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openConfirm(r)}
                      className="min-h-11 shrink-0"
                      disabled={isBusy}
                    >
                      <Plus className="h-4 w-4" /> Lägg till
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              {isLive
                ? "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare."
                : "Demodata"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="name">Namn</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Café Solros"
                />
              </div>
              <EmojiPicker value={photo} onChange={setPhoto} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as PlaceCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cuisines">Kök (komma-separerat)</Label>
                <Input
                  id="cuisines"
                  value={cuisines}
                  onChange={(e) => setCuisines(e.target.value)}
                  placeholder="italienskt, pizza"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="address">Adress</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-area">Område (valfritt)</Label>
              <Input
                id="m-area"
                value={manualArea}
                onChange={(e) => setManualArea(e.target.value)}
                placeholder="t.ex. Haga"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Passar för</Label>
              <p className="text-[11px] text-muted-foreground">
                Välj situation – flera går bra. Snabbt & enkelt, Avslappnat eller Trevlig middag.
              </p>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => {
                  const active = occasions.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setOccasions((cur) =>
                          active ? cur.filter((x) => x !== o) : [...cur, o],
                        )
                      }
                      className="min-h-11"
                    >
                      <Badge
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer rounded-full px-3 py-1 text-xs"
                      >
                        {OCCASION_LABEL[o]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Anteckning (frivilligt)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kort minnesnotering till gruppen…"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="min-h-11"
          >
            Avbryt
          </Button>
          {tab === "manuell" ? (
            <Button onClick={submitManual} disabled={isBusy} className="min-h-11">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lägg till
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function radiusSummary(km: number): string {
  const opt = RADIUS_OPTIONS.find((r) => r.value === km);
  return opt ? opt.short : `inom ${km} km`;
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

const EMOJIS = ["🍽️", "🍕", "🍣", "🍜", "🍔", "🌮", "☕", "🥐", "🍺", "🍦", "🥗", "🍷", "🥟", "🐟"];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-2xl"
        aria-label="Välj emoji"
      >
        {value}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 grid w-56 grid-cols-7 gap-1 rounded-xl border border-border bg-popover p-2 shadow-lg">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => {
                onChange(e);
                setOpen(false);
              }}
              className="rounded-md p-1 text-xl hover:bg-accent"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function emojiForCategory(c: PlaceCategory) {
  switch (c) {
    case "restaurang":
      return "🍽️";
    case "café":
      return "☕";
    case "bageri":
      return "🥐";
    case "snabbmat":
      return "🍔";
    case "pub":
      return "🍺";
    case "matvagn":
      return "🌭";
  }
}
