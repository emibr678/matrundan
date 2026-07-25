import * as React from "react";
import { Search, Loader2, Plus } from "lucide-react";
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
import {
  getPlacesProvider,
  type PlaceSuggestion,
} from "@/lib/matrundan/places-provider";
import { locationForCity } from "@/lib/matrundan/location";

const OCCASIONS: Occasion[] = ["snabbt", "avslappnat", "middag"];

export function AddPlaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addPlace, state } = useStore();
  const [tab, setTab] = React.useState<"sok" | "manuell">("sok");

  // sök & utforska – ett enda fält, gruppens stad som dold bias
  const [query, setQuery] = React.useState("");
  const bias = React.useMemo(
    () => locationForCity(state.group.city) ?? null,
    [state.group.city],
  );
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<PlaceSuggestion[]>([]);

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
      setResults([]);
      setName("");
      setAddress("");
      setManualArea("");
      setCuisines("");
      setNotes("");
      setOccasions(["avslappnat"]);
      setCategory("restaurang");
      setPhoto("🍽️");
      setTab("sok");
      setCity(state.group.city);
    }
  }, [open, state.group.city]);

  React.useEffect(() => {
    if (tab !== "sok" || !open) return;
    const t = setTimeout(() => {
      setLoading(true);
      getPlacesProvider()
        .search({
          query: query.trim() || undefined,
          near: bias,
          mode: "everywhere",
        })
        .then((r) => setResults(r))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [query, bias, tab, open]);

  const pickSuggestion = (s: PlaceSuggestion) => {
    const p = addPlace({
      name: s.name,
      category: s.category,
      cuisines: s.cuisines ?? [],
      occasions: ["avslappnat"],
      address: s.address,
      area: s.area,
      city: s.city,
      lat: s.lat,
      lng: s.lng,
      addedBy: state.currentUserId,
      photo: emojiForCategory(s.category),
    });
    toast.success(`${p.name} tillagd`, {
      description: "Ställen får ligga var som helst – detta är bara ett förslag.",
    });
    onOpenChange(false);
  };

  const submitManual = () => {
    if (!name.trim()) {
      toast.error("Ge stället ett namn");
      return;
    }
    const p = addPlace({
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Lägg till matställe
          </DialogTitle>
          <DialogDescription>
            Sök på namn, kök eller plats. Ställen får ligga var som helst –
            valet av plats är bara ett förslag.
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
              <Label htmlFor="q">Sök matställe eller ort</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="q"
                  placeholder="Namn, kök, kategori eller ort"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {bias
                  ? `Träffar nära ${bias.label} visas först. Sök på ort för att utforska annanstans.`
                  : "Sök i hela Sverige."}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
              </div>
            ) : results.length === 0 ? (
              <EmptyBlock text="Inga träffar. Prova en annan sökterm eller lägg till manuellt." />
            ) : (
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
            )}
            <p className="text-[11px] text-muted-foreground">
              Demo-provider aktiv. När Geoapify kopplas på blir träffarna
              riktiga – gränssnittet är detsamma.
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          {tab === "manuell" ? (
            <Button onClick={submitManual}>Lägg till</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationAutocomplete({
  value,
  onChange,
}: {
  value: LocationBias | null;
  onChange: (v: LocationBias | null) => void;
}) {
  const [input, setInput] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const suggestions = React.useMemo(() => searchLocations(input), [input]);
  const show = focus && !value;

  React.useEffect(() => {
    if (!focus) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocus(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [focus]);

  const pick = (loc: LocationBias) => {
    onChange(loc);
    setInput("");
    setFocus(false);
  };

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      <Label htmlFor="s-location">Var?</Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.label}</div>
            {value.hint ? (
              <div className="text-[11px] text-muted-foreground">{value.hint}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Rensa plats"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="s-location"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocus(true)}
            placeholder="Stad eller stadsdel – t.ex. Enskede"
            className="pl-9"
            autoComplete="off"
          />
          {show ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
            >
              {suggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Inga träffar. Lämna tomt för hela Sverige.
                </div>
              ) : (
                suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {s.hint ? (
                      <span className="text-[11px] text-muted-foreground">
                        {s.hint}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Lämna tomt för att söka i hela Sverige. Ett unikt namn som ”Gamla
        Enskede” räcker – ingen komma behövs.
      </p>
    </div>
  );
}

function ModeToggle({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
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
