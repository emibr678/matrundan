import * as React from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { List, Map, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { ExamplePlaceMap } from "@/components/matrundan/ExamplePlaceMap";
import { OccasionGuide } from "@/components/matrundan/OccasionPicker";
import { PlaceCard, PlaceThumb } from "@/components/matrundan/PlaceCard";
import { PlaceLeaderboard } from "@/components/matrundan/PlaceLeaderboard";
import { PlaceMap } from "@/components/matrundan/PlaceMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appPageTitle } from "@/lib/app-environment";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { rankPlacesForOccasions, rankPlacesOverall } from "@/lib/matrundan/occasions";
import {
  ratingForPlaceInVisitContext,
  type RankableVisitMeal,
} from "@/lib/matrundan/visit-context-ranking";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import {
  CATEGORY_LABEL,
  OCCASION_LABEL,
  type Occasion,
  type PlaceCategory,
} from "@/lib/matrundan/types";

const placesSearchSchema = z.object({
  add: z.enum(["place"]).optional(),
});

export const Route = createFileRoute("/matstallen")({
  validateSearch: zodValidator(placesSearchSchema),
  head: () => ({
    meta: [
      { title: appPageTitle("Matställen") },
      {
        name: "description",
        content: "Sök, filtrera och utforska gruppens matställen i lista eller på karta.",
      },
      { property: "og:title", content: appPageTitle("Matställen") },
      {
        property: "og:description",
        content: "Gruppens gemensamma matställeslista.",
      },
    ],
  }),
  component: PlacesLayout,
});

function PlacesLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  if (pathname !== "/matstallen") return <Outlet />;
  return <PlacesIndex />;
}

type Sort = "senaste" | "betyg" | "namn";
type Filter = "alla" | "favoriter" | "nytt-for-gruppen" | "nytt-for-mig";
type MissingField = "cuisines" | "occasions";
type View = "lista" | "karta";
const QUICK_FILTERS: { key: Filter; label: string }[] = [
  { key: "alla", label: "Alla" },
  { key: "favoriter", label: "Favoriter" },
  { key: "nytt-for-mig", label: "Nytt för mig" },
  { key: "nytt-for-gruppen", label: "Nytt för gruppen" },
];

function toggleFilterValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function PlacesIndex() {
  const { state, demoReadOnly, avgRating, isFavorite, statusOf } = useStore();
  const { exampleMode } = useSession();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/matstallen" });
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<PlaceCategory | "alla">("alla");
  const [occasion, setOccasion] = React.useState<Occasion | "alla">("alla");
  const [missingFields, setMissingFields] = React.useState<MissingField[]>([]);
  const [topOccasions, setTopOccasions] = React.useState<Occasion[]>([]);
  const [topVisits, setTopVisits] = React.useState<RankableVisitMeal[]>([]);
  const [topTakeawayOnly, setTopTakeawayOnly] = React.useState(false);
  const [topOpen, setTopOpen] = React.useState(false);

  const [sort, setSort] = React.useState<Sort>("senaste");
  const [filter, setFilter] = React.useState<Filter>("alla");
  const [view, setView] = React.useState<View>("lista");
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addInitialQuery, setAddInitialQuery] = React.useState("");
  const [filterOpen, setFilterOpen] = React.useState(false);

  const groupArchived = state.group.lifecycleStatus === "archived";
  const canWrite = !groupArchived && !demoReadOnly;
  const activePlaces = React.useMemo(
    () => state.places.filter((place) => place.collectionStatus !== "archived"),
    [state.places],
  );

  const activeAdvancedCount =
    (category !== "alla" ? 1 : 0) +
    (occasion !== "alla" ? 1 : 0) +
    missingFields.length +
    (sort !== "senaste" ? 1 : 0);

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let list = activePlaces.filter((place) => {
      if (category !== "alla" && place.category !== category) return false;
      if (occasion !== "alla" && !place.occasions.includes(occasion)) return false;
      if (missingFields.includes("cuisines") && place.cuisines.length > 0) return false;
      if (missingFields.includes("occasions") && place.occasions.length > 0) return false;
      if (filter === "favoriter" && !isFavorite(place.id)) return false;
      if (filter === "nytt-for-gruppen" && statusOf(place.id) !== "nytt-for-gruppen") {
        return false;
      }
      if (filter === "nytt-for-mig") {
        const status = statusOf(place.id);
        if (status !== "nytt-for-mig" && status !== "nytt-for-gruppen") {
          return false;
        }
      }
      if (!normalizedQuery) return true;
      return (
        place.name.toLowerCase().includes(normalizedQuery) ||
        place.address.toLowerCase().includes(normalizedQuery) ||
        place.city.toLowerCase().includes(normalizedQuery) ||
        place.area?.toLowerCase().includes(normalizedQuery) ||
        place.cuisines.some((cuisine) => cuisine.toLowerCase().includes(normalizedQuery))
      );
    });

    list = [...list];
    if (sort === "betyg") {
      list = list.filter((place) => avgRating(place.id).count > 0);
      list.sort((a, b) => avgRating(b.id).overall - avgRating(a.id).overall);
    } else if (sort === "namn") {
      list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    } else {
      list.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
    }
    return list;
  }, [
    activePlaces,
    query,
    category,
    occasion,
    missingFields,
    filter,
    sort,
    avgRating,
    isFavorite,
    statusOf,
  ]);

  React.useEffect(() => {
    if (selectedPlaceId && filtered.some((place) => place.id === selectedPlaceId)) {
      return;
    }
    setSelectedPlaceId(
      filtered.find((place) => place.lat != null && place.lng != null)?.id ?? null,
    );
  }, [filtered, selectedPlaceId]);

  const overallLeaderboardRating = React.useCallback(
    (placeId: string) =>
      ratingForPlaceInVisitContext(state.visits, placeId, {
        meals: [],
      }),
    [state.visits],
  );
  const overallTopRated = React.useMemo(
    () => rankPlacesOverall(activePlaces, overallLeaderboardRating, activePlaces.length),
    [activePlaces, overallLeaderboardRating],
  );
  const contextualRating = React.useCallback(
    (placeId: string) =>
      ratingForPlaceInVisitContext(state.visits, placeId, {
        meals: topVisits,
        takeawayOnly: topTakeawayOnly,
      }),
    [state.visits, topTakeawayOnly, topVisits],
  );
  const topRated = React.useMemo(
    () =>
      rankPlacesForOccasions(
        activePlaces,
        topOccasions,
        contextualRating,
        activePlaces.length,
      ),
    [activePlaces, contextualRating, topOccasions],
  );
  const topLeader = overallTopRated[0] ?? null;

  const clearAdvanced = () => {
    setCategory("alla");
    setOccasion("alla");
    setMissingFields([]);
    setSort("senaste");
  };

  const openAdd = (initialQuery = "") => {
    setAddInitialQuery(initialQuery);
    setAddOpen(true);
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddOpen(open);
    if (!open) setAddInitialQuery("");
  };

  React.useEffect(() => {
    if (search.add !== "place") return;

    if (canWrite) {
      setAddInitialQuery("");
      setAddOpen(true);
    }

    void navigate({
      search: { add: undefined },
      replace: true,
    });
  }, [canWrite, navigate, search.add]);

  const activePlaceCountLabel =
    activePlaces.length === 1 ? "1 ställe" : `${activePlaces.length} ställen`;
  const trimmedQuery = query.trim();

  const mappedCount = filtered.filter((place) => place.lat != null && place.lng != null).length;
  const unmappedCount = filtered.length - mappedCount;
  const mapItems = filtered.map((place) => ({
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    eyebrow: CATEGORY_LABEL[place.category],
    description: [place.address, place.area, place.city].filter(Boolean).join(" · "),
    markerLabel: place.photo ?? "🍽️",
  }));
  const MapComponent = exampleMode ? ExamplePlaceMap : PlaceMap;

  return (
    <div className="mx-auto max-w-2xl space-y-3 pt-2 md:max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Matställen</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Vad gruppen vill prova och har provat
        </p>
      </div>

      <PlaceLeaderboard
        leader={
          topLeader
            ? {
                id: topLeader.place.id,
                name: topLeader.place.name,
                rating: topLeader.rating.overall,
                reviewCount: topLeader.rating.count,
                visitCount: topLeader.rating.visitCount,
                leading: <PlaceThumb place={topLeader.place} size="sm" />,
              }
            : null
        }
        items={topRated.map(({ place, rating, rank }) => ({
          id: place.id,
          name: place.name,
          rating: rating.overall,
          reviewCount: rating.count,
          rank,
          visitCount: rating.visitCount,
          leading: <PlaceThumb place={place} size="sm" />,
        }))}
        open={topOpen}
        onOpenChange={setTopOpen}
        occasions={topOccasions}
        onToggleOccasion={(occasion) =>
          setTopOccasions((current) => toggleFilterValue(current, occasion))
        }
        meals={topVisits}
        onToggleMeal={(meal) => setTopVisits((current) => toggleFilterValue(current, meal))}
        takeawayOnly={topTakeawayOnly}
        onToggleTakeaway={() => setTopTakeawayOnly((current) => !current)}
        onOpenItem={(item) =>
          void navigate({
            to: "/matstallen/$placeId",
            params: { placeId: item.id },
          })
        }
        emptyMessage={
          topOccasions.length === 0 && topVisits.length === 0 && !topTakeawayOnly
            ? "Inga betyg ännu — de kommer när gruppen har provat något."
            : "Inga betyg matchar de valda filtren ännu."
        }
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">Gruppens ställen</h2>
          <p className="text-xs text-muted-foreground">
            {activePlaceCountLabel} som gruppen vill prova eller har besökt
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            onClick={() => openAdd()}
            size="sm"
            className="shrink-0 rounded-full"
            aria-label="Lägg till ställe"
          >
            <Plus className="h-4 w-4" /> Lägg till
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök bland gruppens ställen"
            className="h-10 rounded-2xl bg-card pl-9"
            aria-label="Sök bland gruppens ställen"
          />
        </div>
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-10 shrink-0 rounded-2xl px-3"
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
              <SheetDescription>Samma urval används i både listan och kartan.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-4">
              <FilterGroup label="Typ av ställe">
                <ChipRow
                  options={[
                    { key: "alla", label: "Alla" },
                    ...Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
                      key,
                      label,
                    })),
                  ]}
                  value={category}
                  onChange={(value) => setCategory(value as PlaceCategory | "alla")}
                />
              </FilterGroup>
              <FilterGroup
                label={
                  <span className="flex min-h-11 items-center gap-1">
                    Typ av upplevelse
                    <OccasionGuide compact />
                  </span>
                }
              >
                <ChipRow
                  options={[
                    { key: "alla", label: "Alla" },
                    ...Object.entries(OCCASION_LABEL).map(([key, label]) => ({
                      key,
                      label,
                    })),
                  ]}
                  value={occasion}
                  onChange={(value) => setOccasion(value as Occasion | "alla")}
                />
              </FilterGroup>
              <FilterGroup label="Saknar uppgifter">
                <MultiChipRow
                  options={[
                    { key: "cuisines", label: "Kök och inriktning" },
                    { key: "occasions", label: "Typ av upplevelse" },
                  ]}
                  values={missingFields}
                  onToggle={(value) =>
                    setMissingFields((current) =>
                      current.includes(value)
                        ? current.filter((item) => item !== value)
                        : [...current, value],
                    )
                  }
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
                  onChange={(value) => setSort(value as Sort)}
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

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              aria-pressed={active}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Badge
                variant={active ? "default" : "outline"}
                className="min-h-8 cursor-pointer rounded-full px-3 py-1"
              >
                {item.label}
              </Badge>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Välj vy">
        <button
          type="button"
          onClick={() => setView("lista")}
          aria-pressed={view === "lista"}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
            view === "lista" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <List className="h-4 w-4" /> Lista
        </button>
        <button
          type="button"
          onClick={() => setView("karta")}
          aria-pressed={view === "karta"}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
            view === "karta" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Map className="h-4 w-4" /> Karta
        </button>
      </div>

      {sort === "betyg" ? (
        <p className="text-xs text-muted-foreground">
          Sorterat på gruppens medelbetyg. Bara ställen med minst ett omdöme visas.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-4xl">🍽️</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {trimmedQuery
              ? `“${trimmedQuery}” finns inte i gruppens lista.`
              : activePlaces.length === 0
                ? "Gruppen har inga ställen ännu."
                : "Inga ställen matchar de valda filtren."}
          </p>
          {trimmedQuery && canWrite ? (
            <Button
              className="mt-4 max-w-full whitespace-normal"
              onClick={() => openAdd(trimmedQuery)}
              aria-label={`Sök efter ${trimmedQuery} och lägg till ställe`}
            >
              <Search className="h-4 w-4" /> Sök och lägg till
            </Button>
          ) : canWrite && activePlaces.length === 0 ? (
            <Button className="mt-4" onClick={() => openAdd()}>
              <Plus className="h-4 w-4" /> Lägg till första stället
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setFilter("alla");
                clearAdvanced();
              }}
            >
              <X className="h-4 w-4" /> Rensa sökning och filter
            </Button>
          )}
        </div>
      ) : view === "lista" ? (
        <div className="space-y-3 pb-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} readOnly={demoReadOnly} />
          ))}
        </div>
      ) : (
        <section className="space-y-2 pb-4">
          <MapComponent
            items={mapItems}
            selectedId={selectedPlaceId}
            onSelect={setSelectedPlaceId}
            onAction={(item) =>
              navigate({
                to: "/matstallen/$placeId",
                params: { placeId: item.id },
              })
            }
            actionLabel="Visa ställe"
            className="h-[62vh] min-h-[420px] max-h-[680px]"
            ariaLabel={`${exampleMode ? "Demokarta" : "Karta"} med ${mappedCount} av ${filtered.length} matställen`}
          />
          {unmappedCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {unmappedCount} {unmappedCount === 1 ? "ställe saknar" : "ställen saknar"}{" "}
              kartposition och visas bara i listan.
            </p>
          ) : null}
        </section>
      )}

      {canWrite ? (
        <AddPlaceDialog
          open={addOpen}
          onOpenChange={handleAddOpenChange}
          initialQuery={addInitialQuery}
        />
      ) : null}
    </div>
  );
}

function FilterGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
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
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge
              variant={active ? "default" : "outline"}
              className="min-h-8 cursor-pointer rounded-full px-3 py-1"
            >
              {option.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

function MultiChipRow({
  options,
  values,
  onToggle,
}: {
  options: { key: MissingField; label: string }[];
  values: MissingField[];
  onToggle: (value: MissingField) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrera på saknade uppgifter">
      {options.map((option) => {
        const active = values.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onToggle(option.key)}
            aria-pressed={active}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge
              variant={active ? "default" : "outline"}
              className="min-h-8 cursor-pointer rounded-full px-3 py-1"
            >
              {option.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
