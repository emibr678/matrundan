import { formatRating } from "@/lib/matrundan/version";
import * as React from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  List,
  Map,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { ExamplePlaceMap } from "@/components/matrundan/ExamplePlaceMap";
import { OccasionGuide } from "@/components/matrundan/OccasionPicker";
import { PlaceCard, PlaceThumb } from "@/components/matrundan/PlaceCard";
import { PlaceMap } from "@/components/matrundan/PlaceMap";
import { RatingStars } from "@/components/matrundan/Rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { rankPlacesForOccasion, rankPlacesOverall } from "@/lib/matrundan/occasions";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import {
  CATEGORY_LABEL,
  OCCASION_LABEL,
  OCCASION_VALUES,
  type Occasion,
  type PlaceCategory,
} from "@/lib/matrundan/types";

export const Route = createFileRoute("/matstallen")({
  head: () => ({
    meta: [
      { title: "Matställen · Matrundan" },
      {
        name: "description",
        content: "Sök, filtrera och utforska gruppens matställen i lista eller på karta.",
      },
      { property: "og:title", content: "Matställen · Matrundan" },
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
type TopListFilter = Occasion | "alla";

const QUICK_FILTERS: { key: Filter; label: string }[] = [
  { key: "alla", label: "Alla" },
  { key: "favoriter", label: "Favoriter" },
  { key: "nytt-for-mig", label: "Nytt för mig" },
  { key: "nytt-for-gruppen", label: "Nytt för gruppen" },
];

const TOP_LIST_FILTERS: { key: TopListFilter; label: string }[] = [
  { key: "alla", label: "Alla" },
  ...OCCASION_VALUES.map((key) => ({ key, label: OCCASION_LABEL[key] })),
];

function PlacesIndex() {
  const { state, demoReadOnly, avgRating, isFavorite, statusOf } = useStore();
  const { exampleMode } = useSession();
  const navigate = useNavigate({ from: "/matstallen" });
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<PlaceCategory | "alla">("alla");
  const [occasion, setOccasion] = React.useState<Occasion | "alla">("alla");
  const [missingFields, setMissingFields] = React.useState<MissingField[]>([]);
  const [topOccasion, setTopOccasion] = React.useState<TopListFilter>("alla");
  const [topOpen, setTopOpen] = React.useState(false);

  const [sort, setSort] = React.useState<Sort>("senaste");
  const [filter, setFilter] = React.useState<Filter>("alla");
  const [view, setView] = React.useState<View>("lista");
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
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

  const topRated = React.useMemo(
    () =>
      topOccasion === "alla"
        ? rankPlacesOverall(activePlaces, avgRating)
        : rankPlacesForOccasion(activePlaces, topOccasion, avgRating),
    [activePlaces, avgRating, topOccasion],
  );
  const hasRatings = activePlaces.some((place) => avgRating(place.id).count > 0);
  const isSearching = query.trim().length > 0;

  const clearAdvanced = () => {
    setCategory("alla");
    setOccasion("alla");
    setMissingFields([]);
    setSort("senaste");
  };

  const mappedCount = filtered.filter((place) => place.lat != null && place.lng != null).length;
  const unmappedCount = filtered.length - mappedCount;
  const mapItems = filtered.map((place) => ({
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    eyebrow: CATEGORY_LABEL[place.category],
    description: [place.address, place.area, place.city].filter(Boolean).join(" · "),
    markerLabel: place.photo ?? "🍽️",
  }));
  const MapComponent = exampleMode ? ExamplePlaceMap : PlaceMap;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-2 md:max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Matställen</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vad gänget vill prova och har provat
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setAddOpen(true)} size="sm" className="shrink-0 rounded-full">
            <Plus className="h-4 w-4" /> Lägg till ställe
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök bland gruppens ställen"
          className="rounded-2xl bg-card pl-9"
          aria-label="Sök bland gruppens ställen"
        />
      </div>

      {hasRatings && !isSearching ? (
        <Collapsible open={topOpen} onOpenChange={setTopOpen}>
          <section
            aria-labelledby="place-leaderboard-heading"
            data-testid="occasion-leaderboard"
            className="rounded-2xl border border-border/70 bg-card/60 px-3 py-2"
          >
            <div className="flex items-center gap-1">
              <h2 id="place-leaderboard-heading" className="font-display text-lg">
                Topplista
              </h2>
              <OccasionGuide compact />
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto min-h-11 rounded-full text-xs text-muted-foreground"
                >
                  {topOpen ? "Dölj" : "Visa"}
                  <ChevronDown
                    className={["h-4 w-4 transition-transform", topOpen ? "rotate-180" : ""].join(
                      " ",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gruppens högst betygsatta ställen
            </p>

            <CollapsibleContent className="pt-3">
              <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Välj topplista">
                {TOP_LIST_FILTERS.map((item) => {
                  const active = topOccasion === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTopOccasion(item.key)}
                      aria-pressed={active}
                      aria-label={
                        item.key === "alla"
                          ? "Visa topplista för alla betyg"
                          : `Visa topplista för ${item.label}`
                      }
                      className="min-h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Badge
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer rounded-full px-3 py-1 text-xs"
                      >
                        {item.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {topRated.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-3">
                  {topRated.map(({ place, rating, rank }) => (
                    <Link
                      key={place.id}
                      to="/matstallen/$placeId"
                      params={{ placeId: place.id }}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {rank}
                      </span>
                      <PlaceThumb place={place} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{place.name}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <RatingStars value={rating.overall} size={12} />
                          <span className="text-xs text-muted-foreground">
                            {formatRating(rating.overall)} · {rating.count} besök
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-4 py-5 text-center text-sm text-muted-foreground">
                  {topOccasion === "alla"
                    ? "Inga betyg ännu — de kommer när gänget har provat något."
                    : `Inga betyg för ${OCCASION_LABEL[topOccasion].toLocaleLowerCase("sv")} ännu — de kommer när gänget har provat något.`}
                </div>
              )}
            </CollapsibleContent>
          </section>
        </Collapsible>
      ) : null}

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
              <SheetDescription>Samma urval används i både listan och kartan.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-4">
              <FilterGroup label="Kategori">
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
                    Passar för
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
                    { key: "cuisines", label: "Kök/inriktning" },
                    { key: "occasions", label: "Passar för" },
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
          Sorterat på gruppens medelbetyg. Bara ställen med minst ett besök visas.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-4xl">🍽️</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Inga ställen matchar just nu. Rensa filtren för att se hela listan
            {canWrite ? " eller lägg till ett nytt smultronställe" : ""}.
          </p>
          {canWrite ? (
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Lägg till ställe
            </Button>
          ) : null}
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

      {canWrite ? <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} /> : null}
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
