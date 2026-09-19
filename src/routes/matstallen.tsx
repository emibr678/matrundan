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
import { appPageTitle } from "@/lib/app-environment";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { rankPlacesForOccasion, rankPlacesOverall } from "@/lib/matrundan/occasions";
import {
  RANKABLE_VISIT_MEALS,
  ratingForPlaceInVisitContext,
  type RankableVisitMeal,
} from "@/lib/matrundan/visit-context-ranking";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import {
  CATEGORY_LABEL,
  OCCASION_LABEL,
  OCCASION_VALUES,
  type Occasion,
  type PlaceCategory,
} from "@/lib/matrundan/types";
import { VISIT_MEAL_LABEL } from "@/lib/matrundan/visit-context";

export const Route = createFileRoute("/matstallen")({
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
type TopListFilter = Occasion | "alla";
type TopVisitFilter = RankableVisitMeal | "alla";

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

const TOP_VISIT_FILTERS: { key: TopVisitFilter; label: string }[] = [
  { key: "alla", label: "Alla tillfällen" },
  ...RANKABLE_VISIT_MEALS.map((key) => ({ key, label: VISIT_MEAL_LABEL[key] })),
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
  const [topVisit, setTopVisit] = React.useState<TopVisitFilter>("alla");
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
        meal: "alla",
      }),
    [state.visits],
  );
  const overallTopRated = React.useMemo(
    () => rankPlacesOverall(activePlaces, overallLeaderboardRating),
    [activePlaces, overallLeaderboardRating],
  );
  const contextualRating = React.useCallback(
    (placeId: string) =>
      ratingForPlaceInVisitContext(state.visits, placeId, {
        meal: topVisit,
        takeawayOnly: topTakeawayOnly,
      }),
    [state.visits, topTakeawayOnly, topVisit],
  );
  const topRated = React.useMemo(
    () =>
      topOccasion === "alla"
        ? rankPlacesOverall(activePlaces, contextualRating)
        : rankPlacesForOccasion(activePlaces, topOccasion, contextualRating),
    [activePlaces, contextualRating, topOccasion],
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
    eyebrow: CATEGORY_LABEL[place.category],
    description: [place.address, place.area, place.city].filter(Boolean).join(" · "),
    markerLabel: place.photo ?? "🍽️",
  }));
  const MapComponent = exampleMode ? ExamplePlaceMap : PlaceMap;

  return (
    <div className="mx-auto max-w-2xl space-y-3 pt-2 md:max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Matställen</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Vad gänget vill prova och har provat</p>
      </div>

      {topLeader ? (
        <Collapsible open={topOpen} onOpenChange={setTopOpen}>
          <section
            aria-labelledby="place-leaderboard-heading"
            data-testid="occasion-leaderboard"
            className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {topOpen ? (
                <h2 id="place-leaderboard-heading" className="min-w-0 flex-1 font-display text-lg">
                  Topplista
                </h2>
              ) : (
                <Link
                  to="/matstallen/$placeId"
                  params={{ placeId: topLeader.place.id }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Ledare i topplistan: ${topLeader.place.name}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="place-leaderboard-heading"
                      className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Topplista
                    </h2>
                    <div className="truncate text-sm font-medium">{topLeader.place.name}</div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2">
                      <RatingStars value={topLeader.rating.overall} size={12} />
                      <span className="truncate text-xs text-muted-foreground">
                        {formatRating(topLeader.rating.overall)} · {topLeader.rating.count}{" "}
                        {topLeader.rating.count === 1 ? "omdöme" : "omdömen"}
                      </span>
                    </div>
                  </div>
                </Link>
              )}
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto min-h-11 shrink-0 rounded-full px-3 text-xs text-muted-foreground"
                  aria-label={topOpen ? "Dölj topplista" : "Visa topp 3"}
                >
                  {topOpen ? "Dölj" : "Visa topp 3"}
                  <ChevronDown
                    className={["h-4 w-4 transition-transform", topOpen ? "rotate-180" : ""].join(
                      " ",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="pt-3">
              <div className="space-y-3">
                <div>
                  <div className="mb-2 flex min-h-8 items-center gap-1 text-sm font-medium text-foreground">
                    <span>Passar för</span>
                    <OccasionGuide compact />
                  </div>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Välj Passar för">
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
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-foreground">Tillfälle</div>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Välj besökstillfälle för topplistan"
                  >
                    {TOP_VISIT_FILTERS.map((item) => {
                      const active = topVisit === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setTopVisit(item.key)}
                          aria-pressed={active}
                          aria-label={
                            item.key === "alla"
                              ? "Visa topplista för alla tillfällen"
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
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setTopTakeawayOnly((current) => !current)}
                      aria-pressed={topTakeawayOnly}
                      aria-label="Visa endast hämtmat i topplistan"
                      className="min-h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Badge
                        variant={topTakeawayOnly ? "default" : "outline"}
                        className="cursor-pointer rounded-full px-3 py-1 text-xs"
                      >
                        Endast hämtmat
                      </Badge>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                {topRated.length > 0 ? (
                  <div className="grid min-w-0 gap-2 md:grid-cols-3">
                    {topRated.map(({ place, rating, rank }) => (
                      <Link
                        key={place.id}
                        to="/matstallen/$placeId"
                        params={{ placeId: place.id }}
                        className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {rank}
                        </span>
                        <PlaceThumb place={place} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{place.name}</div>
                          <div className="mt-0.5 flex min-w-0 items-center gap-2">
                            <RatingStars value={rating.overall} size={12} />
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {formatRating(rating.overall)} · {rating.visitCount ?? 0} besök ·{" "}
                              {rating.count} {rating.count === 1 ? "omdöme" : "omdömen"}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    {topOccasion === "alla" && topVisit === "alla" && !topTakeawayOnly
                      ? "Inga betyg ännu — de kommer när gänget har provat något."
                      : "Inga betyg matchar de valda filtren ännu."}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>
      ) : null}

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
