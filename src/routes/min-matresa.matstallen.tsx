import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { RotateCcw, Search } from "lucide-react";
import { z } from "zod";
import { PlaceIdentityMark } from "@/components/matrundan/PlaceIdentityMark";
import {
  PlaceLeaderboardFilters,
  PlaceLeaderboardRows,
  type PlaceLeaderboardItem,
} from "@/components/matrundan/PlaceLeaderboard";
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
import { appPageTitle } from "@/lib/app-environment";
import { emojiForCategory } from "@/lib/matrundan/add-place-utils";
import {
  loadPersonalJourneyPlace,
  loadPersonalJourneyToplist,
  type PersonalJourneyToplistCursor,
} from "@/lib/matrundan/personal-journey";
import {
  demoPersonalJourneyPlace,
  demoPersonalJourneyToplist,
} from "@/lib/matrundan/personal-journey-demo";
import { formatPersonalJourneyGroups } from "@/lib/matrundan/personal-journey-presentation";
import { useSession } from "@/lib/matrundan/session";
import type { Occasion, PlaceCategory } from "@/lib/matrundan/types";
import type { RankableVisitMeal } from "@/lib/matrundan/visit-context-ranking";
import { formatRating } from "@/lib/matrundan/version";

const defaults = { q: "" };
const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  place: z.string().uuid().optional(),
});

export const Route = createFileRoute("/min-matresa/matstallen")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(defaults)] },
  head: () => ({
    meta: [
      { title: appPageTitle("Topplista") },
      {
        name: "description",
        content: "Ranka och filtrera bedömda matställen från dina grupper.",
      },
    ],
  }),
  component: PersonalJourneyToplist,
});

function PersonalJourneyToplist() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/min-matresa/matstallen" });
  const { mode, selectGroup } = useSession();
  const [queryInput, setQueryInput] = React.useState(search.q);
  const [occasions, setOccasions] = React.useState<Occasion[]>([]);
  const [meals, setMeals] = React.useState<RankableVisitMeal[]>([]);
  const [takeawayOnly, setTakeawayOnly] = React.useState(false);
  React.useEffect(() => setQueryInput(search.q), [search.q]);

  const toplist = useInfiniteQuery({
    queryKey: ["personal-journey", "toplist", mode, search.q, occasions, meals, takeawayOnly],
    retry: false,
    initialPageParam: null as PersonalJourneyToplistCursor | null,
    queryFn: ({ pageParam }) => {
      const options = {
        query: search.q,
        occasions,
        mealTypes: meals,
        takeawayOnly,
        cursor: pageParam,
        limit: 20,
      };
      return mode === "demo"
        ? Promise.resolve(demoPersonalJourneyToplist(options))
        : loadPersonalJourneyToplist(options);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = toplist.data?.pages.flatMap((page) => page.items) ?? [];
  const detail = useQuery({
    queryKey: ["personal-journey", "place", mode, search.place],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyPlace(search.place!))
        : loadPersonalJourneyPlace(search.place!),
    enabled: Boolean(search.place),
  });

  function toggleValue<T extends string>(values: T[], value: T): T[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  function leaderboardItem(
    place: NonNullable<typeof toplist.data>["pages"][number]["items"][number],
  ): PlaceLeaderboardItem {
    const category = place.category as PlaceCategory;
    return {
      id: place.id,
      name: place.name,
      rating: place.rating,
      reviewCount: place.reviewCount,
      rank: place.rank,
      visitCount: place.visitCount,
      leading: (
        <PlaceIdentityMark category={category} symbol={emojiForCategory(category)} size="sm" />
      ),
      context: formatPersonalJourneyGroups(place.groups),
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-6 pt-3">
      <header>
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Topplista</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ställen med omdömen från dina grupper, högst betyg först.
        </p>
      </header>

      <Card className="space-y-3 rounded-2xl border-border/70 p-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({
              search: { q: queryInput.trim(), place: undefined },
              state: (previous) => previous,
            });
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
              placeholder="Sök i Topplistan"
              aria-label="Sök i Topplistan"
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

        <PlaceLeaderboardFilters
          occasions={occasions}
          onToggleOccasion={(occasion) =>
            setOccasions((current) => toggleValue(current, occasion))
          }
          meals={meals}
          onToggleMeal={(meal) => setMeals((current) => toggleValue(current, meal))}
          takeawayOnly={takeawayOnly}
          onToggleTakeaway={() => setTakeawayOnly((current) => !current)}
        />
      </Card>

      {toplist.isPending ? (
        <Card className="animate-pulse rounded-2xl p-6 text-sm text-muted-foreground">
          Hämtar Topplistan…
        </Card>
      ) : toplist.isError ? (
        <Card className="rounded-2xl border-destructive/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">Topplistan kunde inte hämtas.</p>
          <Button className="mt-3" variant="outline" onClick={() => void toplist.refetch()}>
            <RotateCcw className="h-4 w-4" /> Försök igen
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-7 text-center">
          <h2 className="font-medium">Inga bedömda ställen matchar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova en annan sökning eller ändra filtren.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {items.length} {items.length === 1 ? "rankat ställe" : "rankade ställen"}
          </p>
          <PlaceLeaderboardRows
            items={items.map(leaderboardItem)}
            layout="list"
            onOpen={(place) =>
              void navigate({
                search: { ...search, place: place.id },
                state: (previous) => previous,
              })
            }
          />
          {toplist.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={toplist.isFetchingNextPage}
                onClick={() => void toplist.fetchNextPage()}
              >
                {toplist.isFetchingNextPage ? "Hämtar…" : "Visa fler"}
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
