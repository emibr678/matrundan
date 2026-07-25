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
