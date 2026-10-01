import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  CalendarDays,
  MessageSquarePlus,
  RotateCcw,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { z } from "zod";
import { PersonalJourneyVisitCard } from "@/components/matrundan/PersonalJourneyCards";
import { PersonalJourneyReviewGroupChoices } from "@/components/matrundan/PersonalJourneyReviewGroupChoices";
import {
  PERSONAL_STATS_METRICS,
  PersonalJourneyOwnStats,
  PersonalJourneyPeopleRanking,
  PersonalJourneyPersonStatsDialog,
} from "@/components/matrundan/PersonalJourneyStats";
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
import { Switch } from "@/components/ui/switch";
import { appPageTitle } from "@/lib/app-environment";
import {
  loadPersonalJourneyStats,
  loadPersonalJourneyVisit,
  loadPersonalJourneyVisits,
  personalJourneyStatsMetricSchema,
  type PersonalJourneyGroup,
  type PersonalJourneyStatsLeaderboardEntry,
} from "@/lib/matrundan/personal-journey";
import {
  demoPersonalJourneyStats,
  demoPersonalJourneyVisit,
  demoPersonalJourneyVisits,
  isNavigableDemoPersonalJourneyGroup,
} from "@/lib/matrundan/personal-journey-demo";
import { getPersonalJourneyNavigationState } from "@/lib/matrundan/personal-journey-routes";
import { useSession } from "@/lib/matrundan/session";
import { formatOwnVisitDate } from "@/lib/matrundan/sharing-selection";
import { visitMealLabel } from "@/lib/matrundan/visit-context";
import { formatRating } from "@/lib/matrundan/version";

const defaults = { participated: true, metric: "visits" as const };
const searchSchema = z.object({
  participated: fallback(z.boolean(), true).default(true),
  metric: fallback(personalJourneyStatsMetricSchema, "visits").default("visits"),
  visit: z.string().min(1).max(128).optional(),
});

export const Route = createFileRoute("/min-matresa/besok")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(defaults)] },
  head: () => ({
    meta: [
      { title: appPageTitle("Statistik") },
      {
        name: "description",
        content:
          "Din samlade Matrundan-statistik, personer du delar grupper med och din besökshistorik.",
      },
    ],
  }),
  component: PersonalJourneyStatsRoute,
});

function PersonalJourneyStatsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/min-matresa/besok" });
  const location = useRouterState({ select: (state) => state.location });
  const navigationState = getPersonalJourneyNavigationState(location.state);
  const { mode, activeGroupId, selectGroup } = useSession();
  const [reviewGroupChoice, setReviewGroupChoice] = React.useState<{
    visitId: string;
    groups: PersonalJourneyGroup[];
  } | null>(null);
  const [selectedPerson, setSelectedPerson] =
    React.useState<PersonalJourneyStatsLeaderboardEntry | null>(null);

  const stats = useQuery({
    queryKey: ["personal-journey", "stats", mode, search.metric],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyStats(search.metric))
        : loadPersonalJourneyStats(search.metric),
  });

  const visits = useInfiniteQuery({
    queryKey: ["personal-journey", "visits", mode, search.participated],
    retry: false,
    initialPageParam: null as { visitedOn: string; id: string } | null,
    queryFn: ({ pageParam }) =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyVisits(search.participated))
        : loadPersonalJourneyVisits({ participatedOnly: search.participated, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = visits.data?.pages.flatMap((page) => page.items) ?? [];

  const detail = useQuery({
    queryKey: ["personal-journey", "visit", mode, search.visit],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyVisit(search.visit!))
        : loadPersonalJourneyVisit(search.visit!),
    enabled: Boolean(search.visit),
  });

  function openInGroup(visitId: string, groupId: string, reviewFlow = false) {
    const sourceGroupId = activeGroupId;
    selectGroup(groupId);
    void navigate({
      to: "/besok",
      search: {
        visit: visitId,
        group: groupId,
        review: reviewFlow ? "new" : undefined,
        from: reviewFlow ? "min-matresa" : undefined,
      },
      state: reviewFlow
        ? (previous) => ({
            ...previous,
            personalJourney: {
              returnContext: navigationState.returnContext,
              resumeHref: location.href,
              sourceGroupId,
            },
          })
        : (previous) => ({ ...previous, personalJourney: undefined }),
    });
  }

  function canOpenGroup(group: PersonalJourneyGroup) {
    return mode !== "demo" || isNavigableDemoPersonalJourneyGroup(group.groupId);
  }

  function reviewableGroups(groups: PersonalJourneyGroup[]) {
    return groups.filter((group) => group.isWritable && canOpenGroup(group));
  }

  function openReviewFlow(visitId: string, groups: PersonalJourneyGroup[]) {
    const writableGroups = reviewableGroups(groups);
    if (writableGroups.length === 1) {
      openInGroup(visitId, writableGroups[0].groupId, true);
      return;
    }
    if (writableGroups.length > 1) {
      setReviewGroupChoice({ visitId, groups });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-6 pt-3">
      <header>
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Statistik</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Din samlade statistik och lite vänskaplig jämförelse.
        </p>
      </header>

      <section aria-labelledby="own-stats-heading">
        <h3 id="own-stats-heading" className="sr-only">
          Din statistik
        </h3>
        {stats.isPending ? (
          <Card className="animate-pulse rounded-2xl p-5 text-sm text-muted-foreground">
            Hämtar statistik…
          </Card>
        ) : stats.isError ? (
          <Card className="rounded-2xl border-destructive/30 p-4">
            <p className="text-sm font-medium">Statistiken kunde inte hämtas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Besökshistoriken går fortfarande att använda nedan.
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => void stats.refetch()}
            >
              <RotateCcw className="h-4 w-4" /> Försök igen
            </Button>
          </Card>
        ) : (
          <PersonalJourneyOwnStats stats={stats.data.self} />
        )}
      </section>

      {stats.data ? (
        <section aria-labelledby="people-stats-heading">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 id="people-stats-heading" className="font-display text-xl font-semibold">
                Matrundare du känner
              </h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Personer du delar grupp med, jämförda utifrån sin samlade Matrundan-statistik.
            </p>
          </div>

          <div
            className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1"
            role="group"
            aria-label="Välj statistikmått"
          >
            {PERSONAL_STATS_METRICS.map((metric) => (
              <button
                key={metric.id}
                type="button"
                aria-pressed={search.metric === metric.id}
                onClick={() =>
                  void navigate({
                    search: { ...search, metric: metric.id, visit: undefined },
                    state: (previous) => previous,
                    resetScroll: false,
                  })
                }
                className={[
                  "min-h-10 rounded-lg px-2 text-xs font-medium transition-colors",
                  search.metric === metric.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {metric.label}
              </button>
            ))}
          </div>

          <PersonalJourneyPeopleRanking
            people={stats.data.leaderboard}
            metric={search.metric}
            onSelect={setSelectedPerson}
          />
        </section>
      ) : null}

      <section aria-labelledby="visit-history-heading">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 id="visit-history-heading" className="font-display text-xl font-semibold">
              Besökshistorik
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Samma faktiska besök visas bara en gång även om det delas mellan grupper.
          </p>
        </div>

        <Card className="mb-3 rounded-2xl border-border/70 p-3">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <UserRoundCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Bara besök jag var med på
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Stäng av för att även se andra synliga gruppbesök.
              </span>
            </span>
            <Switch
              checked={search.participated}
              onCheckedChange={(checked) =>
                void navigate({
                  search: { ...search, participated: checked, visit: undefined },
                  state: (previous) => previous,
                })
              }
              aria-label="Bara besök jag var med på"
            />
          </label>
        </Card>

        {visits.isPending ? (
          <Card className="animate-pulse rounded-2xl p-6 text-sm text-muted-foreground">
            Hämtar besök…
          </Card>
        ) : visits.isError ? (
          <Card className="rounded-2xl border-destructive/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">Besöken kunde inte hämtas.</p>
            <Button className="mt-3" variant="outline" onClick={() => void visits.refetch()}>
              <RotateCcw className="h-4 w-4" /> Försök igen
            </Button>
          </Card>
        ) : items.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-7 text-center">
            <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h4 className="mt-2 font-medium">Inga besök att visa</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {search.participated
                ? "Inga synliga besök är markerade med dig som deltagare."
                : "Besök från dina grupper visas här när de finns."}
            </p>
          </Card>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
              {items.length} {items.length === 1 ? "besök visat" : "besök visade"}
            </p>
            <div className="space-y-2">
              {items.map((visit) => (
                <PersonalJourneyVisitCard
                  key={visit.id}
                  visit={visit}
                  onOpen={() =>
                    void navigate({
                      search: { ...search, visit: visit.id },
                      state: (previous) => previous,
                    })
                  }
                />
              ))}
            </div>
            {visits.hasNextPage ? (
              <div className="flex justify-center pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={visits.isFetchingNextPage}
                  onClick={() => void visits.fetchNextPage()}
                >
                  {visits.isFetchingNextPage ? "Hämtar…" : "Visa fler"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Dialog
        open={Boolean(search.visit)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewGroupChoice(null);
            void navigate({
              search: { ...search, visit: undefined },
              state: (previous) => previous,
            });
          }
        }}
      >
        <DialogContent>
          {detail.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hämtar besöket…</p>
          ) : detail.data ? (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-2xl">{detail.data.placeName}</DialogTitle>
                <DialogDescription>
                  {formatOwnVisitDate(detail.data.visitedOn)} ·{" "}
                  {visitMealLabel(detail.data.mealType)}
                  {detail.data.isTakeaway ? " · Hämtmat" : ""}
                </DialogDescription>
              </DialogHeader>

              {detail.data.reviewPending ? (
                <Card className="rounded-xl border-primary/20 bg-primary/[0.04] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden="true" />
                      Lämna ditt omdöme
                    </div>
                    {reviewableGroups(detail.data.groups).length > 0 &&
                    reviewGroupChoice?.visitId !== detail.data.id ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openReviewFlow(detail.data!.id, detail.data!.groups)}
                      >
                        Skriv omdöme
                      </Button>
                    ) : null}
                  </div>
                  {reviewGroupChoice?.visitId === detail.data.id ? (
                    <PersonalJourneyReviewGroupChoices
                      className="mt-3"
                      groups={reviewableGroups(reviewGroupChoice.groups)}
                      onCancel={() => setReviewGroupChoice(null)}
                      onSelect={(group) => {
                        const choice = reviewGroupChoice;
                        setReviewGroupChoice(null);
                        openInGroup(choice.visitId, group.groupId, true);
                      }}
                    />
                  ) : null}
                </Card>
              ) : null}

              <div>
                <h3 className="text-sm font-medium">Omdömen du kan se</h3>
                {detail.data.reviews.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {detail.data.reviews.map((review) => (
                      <Card key={review.id} className="rounded-xl border-border/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{review.authorName}</span>
                          {review.overall != null ? (
                            <span className="flex items-center gap-1.5">
                              <RatingStars value={review.overall} size={12} />
                              <span className="text-xs font-medium">
                                {formatRating(review.overall)}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        {review.comment ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {review.comment}
                          </p>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Inga synliga omdömen ännu.</p>
                )}
              </div>

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
                          {group.isArchived ? "Arkiverad grupp" : "Aktiv grupp"}
                        </div>
                      </div>
                      {canOpenGroup(group) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openInGroup(detail.data!.id, group.groupId)}
                        >
                          Öppna
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Besöket är inte längre tillgängligt.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PersonalJourneyPersonStatsDialog
        person={selectedPerson}
        open={Boolean(selectedPerson)}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null);
        }}
      />
    </div>
  );
}
