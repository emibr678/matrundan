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
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<PlaceSuggestion[]>([]);

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<PlaceCategory>("restaurang");
  const [cuisines, setCuisines] = React.useState("");
  const [address, setAddress] = React.useState("");
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
      setCuisines("");
      setNotes("");
      setOccasions(["avslappnat"]);
      setCategory("restaurang");
      setPhoto("🍽️");
      setTab("sok");
    }
  }, [open]);

  const runSearch = async (q: string) => {
    setLoading(true);
    try {
      const r = await getPlacesProvider().search(q, { city: state.group.city });
      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (tab !== "sok" || !open) return;
    const t = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab, open]);

  const pickSuggestion = (s: PlaceSuggestion) => {
    const p = addPlace({
      name: s.name,
      category: s.category,
      cuisines: s.cuisines ?? [],
      occasions: ["avslappnat"],
      address: s.address,
      city: s.city,
      lat: s.lat,
      lng: s.lng,
      addedBy: state.currentUserId,
      photo: emojiForCategory(s.category),
    });
    toast.success(`${p.name} tillagd`, {
      description: "Området är bara ett förslag – ställen får ligga var som helst.",
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
          <DialogTitle className="font-display text-2xl">Lägg till matställe</DialogTitle>
          <DialogDescription>
            Sök efter förslag eller lägg till manuellt. Ställen får ligga var som helst –
            gruppens stad är bara ett förslag.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          {(["sok", "manuell"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-full py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              {t === "sok" ? "Sök" : "Manuellt"}
            </button>
          ))}
        </div>

        {tab === "sok" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök namn, kök eller adress…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="min-h-[180px] space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
                </div>
              ) : results.length ? (
                results.map((r) => (
                  <button
                    key={r.externalId}
                    onClick={() => pickSuggestion(r)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-xl">
                      {emojiForCategory(r.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {CATEGORY_LABEL[r.category]} · {r.address}, {r.city}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Inga träffar. Prova ett annat sökord eller lägg till manuellt.
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Demo-provider aktiv. Byt till Geoapify/OSM när backend är på plats.
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
              <Label>Passar för</Label>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => {
                  const active = occasions.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
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
