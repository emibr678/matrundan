import * as React from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/matrundan/store";
import { PlaceCard } from "@/components/matrundan/PlaceCard";
import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import {
  CATEGORY_LABEL,
  OCCASION_LABEL,
  type Occasion,
  type PlaceCategory,
} from "@/lib/matrundan/types";

export const Route = createFileRoute("/matstallen")({
  head: () => ({
    meta: [
      { title: "Matställen · Matrundan" },
      {
        name: "description",
        content:
          "Sök, filtrera och sortera gruppens matställeslista. Se status och favoriter.",
      },
      { property: "og:title", content: "Matställen · Matrundan" },
      { property: "og:description", content: "Gruppens gemensamma matställeslista." },
    ],
  }),
  component: PlacesLayout,
});

function PlacesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Om vi står på en detaljsida, låt den ta över.
  if (pathname !== "/matstallen") return <Outlet />;
  return <PlacesIndex />;
}

type Sort = "senaste" | "betyg" | "namn";
type Filter = "alla" | "favoriter" | "nytt-for-gruppen" | "nytt-for-mig";

function PlacesIndex() {
  const { state, avgRating, isFavorite, statusOf } = useStore();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<PlaceCategory | "alla">("alla");
  const [occasion, setOccasion] = React.useState<Occasion | "alla">("alla");
  const [sort, setSort] = React.useState<Sort>("senaste");
  const [filter, setFilter] = React.useState<Filter>("alla");
  const [addOpen, setAddOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = state.places.filter((p) => {
      if (category !== "alla" && p.category !== category) return false;
      if (occasion !== "alla" && !p.occasions.includes(occasion)) return false;
      if (filter === "favoriter" && !isFavorite(p.id)) return false;
      if (filter === "nytt-for-gruppen" && statusOf(p.id) !== "nytt-for-gruppen")
        return false;
      if (filter === "nytt-for-mig") {
        const s = statusOf(p.id);
        if (s !== "nytt-for-mig" && s !== "nytt-for-gruppen") return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.cuisines.some((c) => c.toLowerCase().includes(q))
      );
    });

    list = [...list];
    if (sort === "betyg") {
      list.sort((a, b) => avgRating(b.id).overall - avgRating(a.id).overall);
    } else if (sort === "namn") {
      list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    } else {
      list.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
    }
    return list;
  }, [state.places, query, category, occasion, filter, sort, avgRating, isFavorite, statusOf]);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Matställen</h1>
        <Button onClick={() => setAddOpen(true)} size="sm" className="rounded-full">
          <Plus className="h-4 w-4" /> Lägg till
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök namn, kök eller adress…"
          className="rounded-2xl bg-card pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "alla", label: "Alla" },
            { key: "favoriter", label: "Favoriter" },
            { key: "nytt-for-mig", label: "Nytt för mig" },
            { key: "nytt-for-gruppen", label: "Nytt för gruppen" },
          ] as { key: Filter; label: string }[]
        ).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}>
            <Badge
              variant={filter === f.key ? "default" : "outline"}
              className="cursor-pointer rounded-full px-3 py-1"
            >
              {f.label}
            </Badge>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as PlaceCategory | "alla")}
        >
          <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-full bg-card">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alla">Alla kategorier</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={occasion} onValueChange={(v) => setOccasion(v as Occasion | "alla")}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-full bg-card">
            <SelectValue placeholder="Situation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alla">Alla situationer</SelectItem>
            {Object.entries(OCCASION_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="h-9 w-auto min-w-[110px] rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="senaste">Senast tillagt</SelectItem>
            <SelectItem value="betyg">Högst betyg</SelectItem>
            <SelectItem value="namn">Namn A–Ö</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 pb-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-4xl">🍽️</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Inga ställen matchar. Testa att rensa filter eller lägg till ett nytt.
            </p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Lägg till matställe
            </Button>
          </div>
        ) : (
          filtered.map((p) => <PlaceCard key={p.id} place={p} />)
        )}
      </div>

      <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
