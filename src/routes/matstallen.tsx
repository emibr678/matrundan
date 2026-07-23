import * as React from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Search, Plus, SlidersHorizontal, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useStore } from "@/lib/matrundan/store";
import { PlaceCard, PlaceThumb } from "@/components/matrundan/PlaceCard";
import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { RatingStars } from "@/components/matrundan/Rating";
import { StatusBadge } from "@/components/matrundan/StatusBadge";
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
  if (pathname !== "/matstallen") return <Outlet />;
  return <PlacesIndex />;
}

type Sort = "senaste" | "betyg" | "namn";
type Filter = "alla" | "favoriter" | "nytt-for-gruppen" | "nytt-for-mig";

const QUICK_FILTERS: { key: Filter; label: string }[] = [
  { key: "alla", label: "Alla" },
  { key: "favoriter", label: "Favoriter" },
  { key: "nytt-for-mig", label: "Nytt för mig" },
  { key: "nytt-for-gruppen", label: "Nytt för gruppen" },
];

function PlacesIndex() {
  const { state, avgRating, isFavorite, statusOf } = useStore();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<PlaceCategory | "alla">("alla");
  const [occasion, setOccasion] = React.useState<Occasion | "alla">("alla");
  const [sort, setSort] = React.useState<Sort>("senaste");
  const [filter, setFilter] = React.useState<Filter>("alla");
  const [addOpen, setAddOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);

  const activeAdvancedCount =
    (category !== "alla" ? 1 : 0) +
    (occasion !== "alla" ? 1 : 0) +
    (sort !== "senaste" ? 1 : 0);

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
      // Endast betygsatta/besökta rankas när sortering är "betyg"
      list = list.filter((p) => avgRating(p.id).count > 0);
      list.sort((a, b) => avgRating(b.id).overall - avgRating(a.id).overall);
    } else if (sort === "namn") {
      list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    } else {
      list.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
    }
    return list;
  }, [state.places, query, category, occasion, filter, sort, avgRating, isFavorite, statusOf]);

  const topRated = React.useMemo(
    () =>
      [...state.places]
        .map((p) => ({ p, r: avgRating(p.id) }))
        .filter((x) => x.r.count > 0)
        .sort((a, b) => b.r.overall - a.r.overall)
        .slice(0, 3),
    [state.places, avgRating],
  );

  const clearAdvanced = () => {
    setCategory("alla");
    setOccasion("alla");
    setSort("senaste");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-2 md:max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Matställen</h1>
        <Button onClick={() => setAddOpen(true)} size="sm" className="rounded-full">
          <Plus className="h-4 w-4" /> Lägg till
        </Button>
      </div>

      {/* Topp — bara betygsatta */}
      {topRated.length > 0 ? (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-lg">Topplista</h2>
            <span className="text-[11px] text-muted-foreground">
              Baserat på gruppens medelbetyg
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {topRated.map(({ p, r }) => (
              <Link
                key={p.id}
                to="/matstallen/$placeId"
                params={{ placeId: p.id }}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
              >
                <PlaceThumb place={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <RatingStars value={r.overall} size={12} />
                    <span className="text-xs text-muted-foreground">
                      {r.overall.toFixed(1)} · {r.count}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök namn, kök eller adress…"
          className="rounded-2xl bg-card pl-9"
          aria-label="Sök i matställen"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Badge
                variant={active ? "default" : "outline"}
                className="min-h-8 cursor-pointer rounded-full px-3 py-1"
              >
                {f.label}
              </Badge>
            </button>
          );
        })}

        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto rounded-full"
              aria-label="Öppna filter och sortering"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeAdvancedCount > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                  {activeAdvancedCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Filter & sortering</SheetTitle>
              <SheetDescription>
                Sortering efter betyg bygger på gruppens medelbetyg och visar
                bara besökta ställen.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-4">
              <FilterGroup label="Kategori">
                <ChipRow
                  options={[{ key: "alla", label: "Alla" } as const].concat(
                    Object.entries(CATEGORY_LABEL).map(([k, v]) => ({
                      key: k,
                      label: v,
                    })),
                  )}
                  value={category}
                  onChange={(v) => setCategory(v as PlaceCategory | "alla")}
                />
              </FilterGroup>
              <FilterGroup label="Tillfälle">
                <ChipRow
                  options={[{ key: "alla", label: "Alla" } as const].concat(
                    Object.entries(OCCASION_LABEL).map(([k, v]) => ({
                      key: k,
                      label: v,
                    })),
                  )}
                  value={occasion}
                  onChange={(v) => setOccasion(v as Occasion | "alla")}
                />
              </FilterGroup>
              <FilterGroup label="Sortera">
                <ChipRow
                  options={[
                    { key: "senaste", label: "Senast tillagt" },
                    { key: "betyg", label: "Högst medelbetyg" },
                    { key: "namn", label: "Namn A–Ö" },
                  ]}
                  value={sort}
                  onChange={(v) => setSort(v as Sort)}
                />
              </FilterGroup>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={clearAdvanced}>
                <X className="h-4 w-4" /> Rensa
              </Button>
              <Button onClick={() => setFilterOpen(false)}>Visa {filtered.length}</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {sort === "betyg" ? (
        <p className="text-xs text-muted-foreground">
          Sorterat på gruppens medelbetyg. Bara ställen med minst ett besök visas.
        </p>
      ) : null}

      <div className="space-y-3 pb-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center md:col-span-2">
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

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge
              variant={active ? "default" : "outline"}
              className="min-h-8 cursor-pointer rounded-full px-3 py-1"
            >
              {o.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

// Keep import referenced for the status token used inside children implicitly
void StatusBadge;
