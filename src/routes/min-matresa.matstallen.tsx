import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { MapPin, RotateCcw, Search } from "lucide-react";
import { z } from "zod";
import {
  PlaceLeaderboard,
  type PlaceLeaderboardItem,
} from "@/components/matrundan/PlaceLeaderboard";
import { PersonalJourneyPlaceCard } from "@/components/matrundan/PersonalJourneyCards";
import { RatingStars } from "@/components/matrundan/Rating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { appPageTitle } from "@/lib/app-environment";
import {
  loadPersonalJourneyPlace,
  loadPersonalJourneyPlaces,
  loadPersonalJourneyToplist,
  personalJourneyPlaceSortSchema,
  type PersonalJourneyPlaceCursor,
} from "@/lib/matrundan/personal-journey";
import {
  demoPersonalJourneyPlace,
  demoPersonalJourneyPlaces,
  demoPersonalJourneyToplist,
} from "@/lib/matrundan/personal-journey-demo";
import { formatPersonalJourneyGroups } from "@/lib/matrundan/personal-journey-presentation";
import { useSession } from "@/lib/matrundan/session";
import type { Occasion } from "@/lib/matrundan/types";
import type { RankableVisitMeal } from "@/lib/matrundan/visit-context-ranking";
import { formatRating } from "@/lib/matrundan/version";

const defaults = { q: "", favorites: false, visited: false, sort: "rating" as const };
const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  favorites: fallback(z.boolean(), false).default(false),
  visited: fallback(z.boolean(), false).default(false),
  sort: fallback(personalJourneyPlaceSortSchema, "rating").default("rating"),
  place: z.string().uuid().optional(),
});

export const Route = createFileRoute("/min-matresa/matstallen")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(defaults)] },
  head: () => ({
    meta: [
      { title: appPageTitle("Mina matställen") },
      {
        name: "description",
        content: "Sök bland matställen och favoriter som du kan se genom dina grupper.",
      },
    ],
  }),
  component: PersonalJourneyPlaces,
});

function PersonalJourneyPlaces() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/min-matresa/matstallen" });
  const { mode, selectGroup } = useSession();
  const [queryInput, setQueryInput] = React.useState(search.q);
  const [topOpen, setTopOpen] = React.useState(false);
  const [topOccasions, setTopOccasions] = React.useState<Occasion[]>([]);
  const [topMeals, setTopMeals] = React.useState<RankableVisitMeal[]>([]);
  const [topTakeawayOnly, setTopTakeawayOnly] = React.useState(false);
  React.useEffect(() => setQueryInput(search.q), [search.q]);

  const toplist = useQuery({
    queryKey: [
      "personal-journey",
      "toplist",
      mode,
      topOccasions,
      topMeals,
      topTakeawayOnly,
    ],
    retry: false,
    queryFn: () => {
      const options = {
        occasions: topOccasions,
        mealTypes: topMeals,
        takeawayOnly: topTakeawayOnly,
        limit: 3,
      };
      return mode === "demo"
        ? Promise.resolve(demoPersonalJourneyToplist(options))
        : loadPersonalJourneyToplist(options);
    },
  });

  const places = useInfiniteQuery({
    queryKey: [
      "personal-journey",
      "places",
      mode,
      search.q,
      search.favorites,
      search.visited,
      search.sort,
    ],
    retry: false,
    initialPageParam: null as PersonalJourneyPlaceCursor | null,
    queryFn: ({ pageParam }) => {
      const options = {
        query: search.q,
        favoritesOnly: search.favorites,
        visitedByMeOnly: search.visited,
        sort: search.sort,
        cursor: pageParam,
      };
      return mode === "demo"
        ? Promise.resolve(demoPersonalJourneyPlaces(options))
        : loadPersonalJourneyPlaces(options);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = places.data?.pages.flatMap((page) => page.items) ?? [];
  const detail = useQuery({
    queryKey: ["personal-journey", "place", mode, search.place],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyPlace(search.place!))
        : loadPersonalJourneyPlace(search.place!),
    enabled: Boolean(search.place),
  });

  function updateFilters(next: Partial<typeof search>) {
    void navigate({
      search: { ...search, ...next, place: undefined },
      state: (previous) => previous,
    });
  }

  function toggleValue<T extends string>(values: T[], value: T): T[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  function leaderboardItem(place: NonNullable<typeof toplist.data>["items"][number]): PlaceLeaderboardItem {
    return {
      id: place.id,
      name: place.name,
      rating: place.rating,
      reviewCount: place.reviewCount,
      visitCount: place.visitCount,
      leading: (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
      ),
      context: formatPersonalJourneyGroups(place.groups),
    };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-6 pt-3">
      <header>
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Mina matställen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ett ställe visas en gång, även när det finns i flera av dina grupper.
        </p>
      </header>

      {toplist.isError ? (
        <Card className="rounded-2xl border-destructive/30 p-4 text-sm text-muted-foreground">
          Topplistan kunde inte hämtas. Dina matställen går fortfarande att använda nedan.
        </Card>
      ) : toplist.data?.leader ? (
        <PlaceLeaderboard
          leader={leaderboardItem(toplist.data.leader)}
          items={toplist.data.items.map(leaderboardItem)}
          open={topOpen}
          onOpenChange={setTopOpen}
          occasions={topOccasions}
          onToggleOccasion={(occasion) =>
            setTopOccasions((current) => toggleValue(current, occasion))
          }
          meals={topMeals}
          onToggleMeal={(meal) => setTopMeals((current) => toggleValue(current, meal))}
          takeawayOnly={topTakeawayOnly}
          onToggleTakeaway={() => setTopTakeawayOnly((current) => !current)}
          onOpenItem={(item) =>
            void navigate({
              search: { ...search, place: item.id },
              state: (previous) => previous,
            })
          }
        />
      ) : null}

      <Card className="space-y-3 rounded-2xl border-border/70 p-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateFilters({ q: queryInput.trim() });
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Sök namn eller område"
              aria-label="Sök bland mina matställen"
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Sök</span>
          </Button>
        </form>
        <Select
          value={search.sort}
          onValueChange={(value) =>
            updateFilters({ sort: personalJourneyPlaceSortSchema.parse(value) })
          }
        >
          <SelectTrigger
            id="personal-place-sort"
            aria-label="Sortera matställen"
            className="h-11 w-full rounded-xl"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-muted-foreground">Sortera:</span>
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Högst betyg</SelectItem>
            <SelectItem value="recent">Senast besökt</SelectItem>
            <SelectItem value="name">A–Ö</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/70 px-2.5 py-1.5 text-xs sm:text-sm">
            <span>Favoriter</span>
            <Switch
              checked={search.favorites}
              onCheckedChange={(checked) => updateFilters({ favorites: checked })}
              aria-label="Visa bara mina favoriter"
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/70 px-2.5 py-1.5 text-xs sm:text-sm">
            <span>Besökta av mig</span>
            <Switch
              checked={search.visited}
              onCheckedChange={(checked) => updateFilters({ visited: checked })}
              aria-label="Visa bara matställen jag har besökt"
            />
          </label>
        </div>
      </Card>

      {places.isPending ? (
        <Card className="animate-pulse rounded-2xl p-6 text-sm text-muted-foreground">
          Hämtar matställen…
        </Card>
      ) : places.isError ? (
        <Card className="rounded-2xl border-destructive/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">Matställena kunde inte hämtas.</p>
          <Button className="mt-3" variant="outline" onClick={() => void places.refetch()}>
            <RotateCcw className="h-4 w-4" /> Försök igen
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-7 text-center">
          <MapPin className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-2 font-medium">Inga matställen matchar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova en annan sökning eller stäng av något filter.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {items.length} {items.length === 1 ? "matställe visat" : "matställen visade"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((place) => (
              <PersonalJourneyPlaceCard
                key={place.id}
                place={place}
                onOpen={() =>
                  void navigate({
                    search: { ...search, place: place.id },
                    state: (previous) => previous,
                  })
                }
              />
            ))}
          </div>
          {places.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={places.isFetchingNextPage}
                onClick={() => void places.fetchNextPage()}
              >
                {places.isFetchingNextPage ? "Hämtar…" : "Visa fler"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={Boolean(search.place)}
        onOpenChange={(open) => {
          if (!open) {
            void navigate({
              search: { ...search, place: undefined },
              state: (previous) => previous,
            });
          }
        }}
      >
        <DialogContent>
          {detail.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hämtar matstället…</p>
          ) : detail.data ? (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-2xl">{detail.data.name}</DialogTitle>
                <DialogDescription>
                  {[detail.data.address, detail.data.area, detail.data.city]
                    .filter(Boolean)
                    .join(", ")}
                </DialogDescription>
              </DialogHeader>
              {detail.data.rating != null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars value={detail.data.rating} />
                  <span className="text-sm font-medium">{formatRating(detail.data.rating)}</span>
                  <span className="text-sm text-muted-foreground">
                    · {detail.data.reviewCount} synliga omdömen
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inget synligt betyg ännu.</p>
              )}
              {detail.data.cuisines.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.data.cuisines.map((cuisine) => (
                    <span key={cuisine} className="rounded-full bg-muted px-2 py-1 text-xs">
                      {cuisine}
                    </span>
                  ))}
                </div>
              ) : null}
              <div>
                <h3 className="text-sm font-medium">Finns i</h3>
                <div className="mt-2 space-y-2">
                  {detail.data.groups.map((group) => (
                    <div
                      key={group.groupId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{group.groupName}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.isArchived
                            ? "Arkiverad grupp"
                            : group.isFavorite
                              ? "Favorit här"
                              : "Aktiv grupp"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          selectGroup(group.groupId);
                          void navigate({
                            to: "/matstallen/$placeId",
                            params: { placeId: detail.data!.id },
                            state: (previous) => ({ ...previous, personalJourney: undefined }),
                          });
                        }}
                      >
                        Öppna
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPersonalJourneyGroups(detail.data.groups)}
              </p>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Matstället är inte längre tillgängligt.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
