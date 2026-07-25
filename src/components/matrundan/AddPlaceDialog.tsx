import * as React from "react";
import { Search, Loader2, Plus, List as ListIcon, Map as MapIcon } from "lucide-react";
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
const RADIUS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Inom 1 km" },
  { value: 3, label: "Inom 3 km" },
  { value: 5, label: "Inom 5 km" },
  { value: 10, label: "Inom 10 km" },
  { value: 25, label: "Inom 25 km" },
  { value: 9999, label: "Hela landet" },
];
const DEFAULT_RADIUS = 5;

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
  const [providerError, setProviderError] = React.useState<string | null>(null);

  // sök & utforska
  const [query, setQuery] = React.useState("");
  const [location, setLocation] = React.useState(state.group.city);
  const [radiusKm, setRadiusKm] = React.useState<number>(DEFAULT_RADIUS);
  const [view, setView] = React.useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<PlaceSuggestion[]>([]);

  // Live-läge: cachea koordinaterna för Plats-texten så vi inte
  // geokodar på varje tangenttryck och för att kunna filtrera på radie.
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(null);
  const [centerLabel, setCenterLabel] = React.useState<string>("");
  const [locationSuggestions, setLocationSuggestions] = React.useState<
    { label: string; city: string; area?: string; lat?: number; lng?: number }[]
  >([]);
  const [showLocationSuggest, setShowLocationSuggest] = React.useState(false);

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

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setLocation(state.group.city);
      setRadiusKm(DEFAULT_RADIUS);
      setView("list");
      setSelectedId(null);
      setResults([]);
      setCenter(null);
      setCenterLabel("");
      setLocationSuggestions([]);
      setShowLocationSuggest(false);
      setProviderError(null);
      setName("");
      setAddress("");
      setManualArea("");
      setCuisines("");
      setNotes("");
      setOccasions(["avslappnat"]);
      setCategory("restaurang");
      setPhoto("🍽️");
      setTab("sok");
    }
  }, [open, state.group.city]);

  const cityValid = parsed.city.trim().length > 0;

  // Live-läge: autocomplete-förslag för Plats-fältet.
  React.useEffect(() => {
    if (!isLive || !open || tab !== "sok") return;
    const text = location.trim();
    if (text.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      geoapifyAutocompleteLocation({ data: { text, limit: 6 } })
        .then((rows) => {
          if (cancelled) return;
          setLocationSuggestions(rows);
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setLocationSuggestions([]);
          if ((e as { code?: string })?.code === "geoapify_not_configured") {
            setProviderError(e.message);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isLive, open, tab, location]);

  // Sök-effekten: demo eller live beroende på läge.
  React.useEffect(() => {
    if (tab !== "sok" || !open || !cityValid) {
      if (!cityValid) setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (isLive) {
          // Se till att vi har koordinater för Plats-texten.
          let c = center;
          const targetLabel = formatLocation(parsed);
          if (!c || centerLabel !== targetLabel) {
            const rows = await geoapifyAutocompleteLocation({
              data: { text: targetLabel, limit: 1 },
            });
            const first = rows[0];
            if (!first || first.lat == null || first.lng == null) {
              if (!cancelled) {
                setResults([]);
                setLoading(false);
              }
              return;
            }
            c = { lat: first.lat, lng: first.lng };
            if (!cancelled) {
              setCenter(c);
              setCenterLabel(targetLabel);
            }
          }
          const rows = await geoapifySearchPlaces({
            data: {
              text: query.trim() || undefined,
              lat: c.lat,
              lng: c.lng,
              radiusKm: radiusKm >= 9999 ? null : radiusKm,
              limit: 25,
            },
          });
          if (cancelled) return;
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
            raw: r.raw,
          }));
          setResults(mapped);
          setSelectedId(mapped[0]?.externalId ?? null);
          setProviderError(null);
        } else {
          const r = await getPlacesProvider().search({
            query: query.trim() || undefined,
            city: parsed.city,
            area: parsed.area,
            radiusKm: radiusKm >= 9999 ? null : radiusKm,
          });
          if (cancelled) return;
          setResults(r);
          setSelectedId(r[0]?.externalId ?? null);
        }
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        const err = e as Error & { code?: string };
        if (err?.code === "geoapify_not_configured") {
          setProviderError(err.message);
        } else {
          setProviderError(err.message ?? "Kunde inte hämta förslag.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
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
  ]);

  const pickSuggestion = async (s: PlaceSuggestion) => {
    if (isBusy) return;
    setBusy(true);
    try {
      const base = {
        name: s.name,
        category: s.category,
        cuisines: s.cuisines ?? [],
        occasions: ["avslappnat"] as Occasion[],
        address: s.address,
        area: s.area,
        city: s.city,
        lat: s.lat,
        lng: s.lng,
        addedBy: state.currentUserId,
        photo: emojiForCategory(s.category),
      };
      const p =
        isLive && s.provider && s.provider !== "demo"
          ? await addProviderPlace({
              provider: s.provider,
              providerPlaceId: s.externalId,
              place: base,
              raw: s.raw ? safeParse(s.raw) : {},
            })
          : await addPlace(base);
      toast.success(`${p.name} tillagd`, {
        description: "Området är bara ett förslag – ställen får ligga var som helst.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Kunde inte lägga till stället.");
    } finally {
      setBusy(false);
    }
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

  const filterSummary = `${formatLocation(parsed)} · ${
    radiusKm >= 9999 ? "hela landet" : `inom ${radiusKm} km`
  }`;

  const hasCoords = results.some((r) => r.lat != null && r.lng != null);
  const selected = results.find((r) => r.externalId === selectedId) ?? null;

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
                "rounded-full py-1.5 text-sm font-medium transition-colors",
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
                    // Låt klick på förslag hinna innan vi stänger.
                    setTimeout(() => setShowLocationSuggest(false), 150)
                  }
                  placeholder="Stad, eller ”Område, Stad” (t.ex. Haga, Göteborg)"
                  aria-invalid={!cityValid}
                  autoComplete="off"
                />
                {isLive &&
                showLocationSuggest &&
                locationSuggestions.length > 0 ? (
                  <ul
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
                  >
                    {locationSuggestions.map((s, i) => (
                      <li key={`${s.label}-${i}`}>
                        <button
                          type="button"
                          className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setLocation(
                              s.area ? `${s.area}, ${s.city}` : s.city,
                            );
                            if (s.lat != null && s.lng != null) {
                              setCenter({ lat: s.lat, lng: s.lng });
                              setCenterLabel(
                                s.area ? `${s.area}, ${s.city}` : s.city,
                              );
                            }
                            setShowLocationSuggest(false);
                          }}
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Söker i {formatLocation(parsed)}. Skriv med komma för att peka
                ut ett område.
              </p>
              {providerError ? (
                <p className="text-[11px] text-destructive">{providerError}</p>
              ) : null}
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

            <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-xs">
              <span className="truncate text-muted-foreground">
                {filterSummary}
              </span>
              {results.length > 0 && hasCoords ? (
                <div className="ml-2 flex gap-1 rounded-full bg-background p-0.5">
                  <ViewToggle
                    active={view === "list"}
                    onClick={() => setView("list")}
                    icon={<ListIcon className="h-3.5 w-3.5" />}
                    label="Lista"
                  />
                  <ViewToggle
                    active={view === "map"}
                    onClick={() => setView("map")}
                    icon={<MapIcon className="h-3.5 w-3.5" />}
                    label="Karta"
                  />
                </div>
              ) : null}
            </div>

            {!cityValid ? (
              <EmptyBlock text="Ange en stad för att börja utforska." />
            ) : loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
              </div>
            ) : results.length === 0 ? (
              <EmptyBlock
                text={
                  parsed.area
                    ? `Inga träffar i ${parsed.area} (${parsed.city}) inom ${radiusKm >= 9999 ? "hela landet" : radiusKm + " km"}. Prova ett bredare område eller lägg till manuellt.`
                    : "Inga träffar i området. Prova en annan sökterm eller större radie."
                }
              />
            ) : view === "list" ? (
              <div className="space-y-2">
                {results.map((r) => (
                  <div
                    key={r.externalId}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-xl">
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
                    </div>
                    <Button
                      size="sm"
                      onClick={() => pickSuggestion(r)}
                      className="min-h-11"
                    >
                      <Plus className="h-4 w-4" /> Lägg till
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <DemoMap
                results={results.filter((r) => r.lat != null && r.lng != null)}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAdd={pickSuggestion}
                selected={selected}
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Demo-provider aktiv. Riktig kartdata och platssök aktiveras när
              backend kopplas på.
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Avbryt
          </Button>
          {tab === "manuell" ? (
            <Button onClick={submitManual} disabled={isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lägg till
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function DemoMap({
  results,
  selectedId,
  onSelect,
  onAdd,
  selected,
}: {
  results: PlaceSuggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (s: PlaceSuggestion) => void;
  selected: PlaceSuggestion | null;
}) {
  if (results.length === 0) {
    return <EmptyBlock text="Inga koordinater att visa på karta." />;
  }

  const lats = results.map((r) => r.lat!);
  const lngs = results.map((r) => r.lng!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const dLat = Math.max(maxLat - minLat, 0.005);
  const dLng = Math.max(maxLng - minLng, 0.005);

  return (
    <div className="space-y-2">
      <div
        className="relative h-64 w-full overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(135deg,hsl(var(--secondary))_0%,hsl(var(--muted))_100%)]"
        role="img"
        aria-label="Kartvy (demo) av sökresultaten"
      >
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
          Kartvy (demo) · riktig kartdata aktiveras senare
        </div>
        {results.map((r) => {
          const left = 8 + ((r.lng! - minLng) / dLng) * 84;
          const top = 12 + (1 - (r.lat! - minLat) / dLat) * 76;
          const active = r.externalId === selectedId;
          return (
            <button
              key={r.externalId}
              type="button"
              onClick={() => onSelect(r.externalId)}
              aria-pressed={active}
              aria-label={r.name}
              className={[
                "absolute -translate-x-1/2 -translate-y-full rounded-full px-2 py-1 text-xs font-medium shadow-md transition-transform",
                active
                  ? "z-10 scale-110 bg-primary text-primary-foreground"
                  : "bg-background text-foreground",
              ].join(" ")}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              {emojiForCategory(r.category)}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-xl">
            {emojiForCategory(selected.category)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{selected.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {CATEGORY_LABEL[selected.category]}
              {selected.area ? ` · ${selected.area}` : ""}
              {selected.distanceKm != null ? ` · ~${selected.distanceKm} km` : ""}
            </div>
          </div>
          <Button size="sm" onClick={() => onAdd(selected)} className="min-h-11">
            <Plus className="h-4 w-4" /> Lägg till
          </Button>
        </div>
      ) : null}
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
        className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-2xl"
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
