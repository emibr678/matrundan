import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MessageSquarePlus, RotateCcw } from "lucide-react";
import { PlaceIdentityMark } from "@/components/matrundan/PlaceIdentityMark";
import { PlaceLeaderboardRows } from "@/components/matrundan/PlaceLeaderboard";
import { PersonalJourneyVisitCard } from "@/components/matrundan/PersonalJourneyCards";
import { PersonalJourneyReviewGroupDialog } from "@/components/matrundan/PersonalJourneyReviewGroupDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appPageTitle } from "@/lib/app-environment";
import { emojiForCategory } from "@/lib/matrundan/add-place-utils";
import {
  loadPersonalJourneyOverview,
  type PersonalJourneyGroup,
  type PersonalJourneyPendingReview,
} from "@/lib/matrundan/personal-journey";
import { DEMO_PERSONAL_JOURNEY_OVERVIEW } from "@/lib/matrundan/personal-journey-demo";
import { formatPersonalJourneyGroups } from "@/lib/matrundan/personal-journey-presentation";
import { getPersonalJourneyNavigationState } from "@/lib/matrundan/personal-journey-routes";
import { useSession } from "@/lib/matrundan/session";
import type { PlaceCategory } from "@/lib/matrundan/types";
import { formatOwnVisitDate } from "@/lib/matrundan/sharing-selection";

export const Route = createFileRoute("/min-matresa/")({
  head: () => ({
    meta: [
      { title: appPageTitle("Min matresa") },
      {
        name: "description",
        content: "Din personliga översikt över matställen, besök och favoriter från dina grupper.",
      },
    ],
  }),
  component: PersonalJourneyOverview,
});

function summaryText(visitCount: number, placeCount: number, groupCount: number) {
  if (visitCount === 0) {
    return groupCount === 1
      ? "Din matresa börjar när du deltar i ett besök med gruppen."
      : `Din matresa börjar när du deltar i ett besök i någon av dina ${groupCount} grupper.`;
  }
  const visits = `${visitCount} ${visitCount === 1 ? "besök" : "besök"}`;
  const places = `${placeCount} ${placeCount === 1 ? "matställe" : "matställen"}`;
  const groups = `${groupCount} ${groupCount === 1 ? "grupp" : "grupper"}`;
  return `${visits} på ${places} · ${groups}`;
}

function PersonalJourneyOverview() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const navigationState = getPersonalJourneyNavigationState(location.state);
  const { mode, activeGroupId, selectGroup } = useSession();
  const [reviewGroupChoice, setReviewGroupChoice] =
    React.useState<PersonalJourneyPendingReview | null>(null);
  const overview = useQuery({
    queryKey: ["personal-journey", "overview", mode],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(DEMO_PERSONAL_JOURNEY_OVERVIEW)
        : loadPersonalJourneyOverview(),
  });

  function handoffPendingReview(item: PersonalJourneyPendingReview, target: PersonalJourneyGroup) {
    const sourceGroupId = activeGroupId;
    selectGroup(target.groupId);
    void navigate({
      to: "/besok",
      search: { visit: item.visitId, group: target.groupId, from: "min-matresa" },
      state: (previous) => ({
        ...previous,
        personalJourney: {
          returnContext: navigationState.returnContext,
          resumeHref: location.href,
          sourceGroupId,
        },
      }),
    });
  }

  function openPendingReview(item: PersonalJourneyPendingReview) {
    const writableGroups = item.groups.filter((group) => group.isWritable);
    if (writableGroups.length === 1) {
      handoffPendingReview(item, writableGroups[0]);
      return;
    }
    if (writableGroups.length > 1) {
      setReviewGroupChoice(item);
    }
  }

  if (overview.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-6 pt-5" aria-busy="true">
        <Card className="animate-pulse rounded-2xl border-border/70 p-6 text-sm text-muted-foreground">
          Hämtar din matresa…
        </Card>
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-6 pt-6 text-center">
        <h2 className="font-display text-2xl font-semibold">Översikten kunde inte hämtas</h2>
        <p className="text-sm text-muted-foreground">Försök igen. Dina gruppdata påverkas inte.</p>
        <Button type="button" variant="outline" onClick={() => void overview.refetch()}>
          <RotateCcw className="h-4 w-4" /> Försök igen
        </Button>
      </div>
    );
  }

  const data = overview.data;
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-6 pt-4">
      <div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Här samlas ställena ni uppskattat mest, sådant du behöver följa upp och din senaste
          gemensamma mathistorik.
        </p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {summaryText(
            data.summary.attendedVisitCount,
            data.summary.attendedPlaceCount,
            data.summary.readableGroupCount,
          )}
        </p>
      </div>

      {data.pendingReviews.length > 0 ? (
        <section aria-labelledby="pending-reviews-heading">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 id="pending-reviews-heading" className="font-display text-xl font-semibold">
              Omdömen att komplettera
            </h2>
          </div>
          <Card className="divide-y divide-border/60 overflow-hidden rounded-2xl border-primary/20 bg-primary/[0.035] p-0">
            {data.pendingReviews.map((item) => {
              const writableGroups = item.groups.filter((group) => group.isWritable);
              const reviewContext =
                writableGroups.length === 1
                  ? writableGroups[0].groupName
                  : writableGroups.length > 1
                    ? `${writableGroups.length} grupper`
                    : "Arkiverad grupp";
              return (
                <div
                  key={item.visitId}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium [overflow-wrap:anywhere]">{item.placeName}</div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatOwnVisitDate(item.visitedOn)} · {reviewContext}
                    </p>
                  </div>
                  {writableGroups.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-11 shrink-0"
                      onClick={() => openPendingReview(item)}
                    >
                      Skriv omdöme <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Gruppen är arkiverad</span>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      ) : null}

      {data.topRatedPlaces.length > 0 ? (
        <section aria-labelledby="top-rated-places-heading">
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="top-rated-places-heading" className="font-display text-xl font-semibold">
                Topplista
              </h2>
              <p className="text-xs text-muted-foreground">Högst betyg i dina grupper</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full">
              <Link
                to="/min-matresa/matstallen"
                state={(previous) => previous}
              >
                Visa alla <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <PlaceLeaderboardRows
            items={data.topRatedPlaces.map((place, index) => {
              const category = place.category as PlaceCategory;
              return {
                id: place.id,
                name: place.name,
                rating: place.rating ?? 0,
                reviewCount: place.reviewCount,
                rank: index + 1,
                leading: (
                  <PlaceIdentityMark
                    category={category}
                    symbol={emojiForCategory(category)}
                    size="sm"
                  />
                ),
                context: formatPersonalJourneyGroups(place.groups),
              };
            })}
            onOpen={(place) =>
              void navigate({
                to: "/min-matresa/matstallen",
                search: { place: place.id },
                state: (previous) => previous,
              })
            }
          />
        </section>
      ) : null}

      <section aria-labelledby="recent-visits-heading">
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 id="recent-visits-heading" className="font-display text-xl font-semibold">
              Senaste besöken
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/min-matresa/besok" state={(previous) => previous}>
              Visa alla <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {data.recentVisits.length > 0 ? (
          <div className="space-y-3">
            {data.recentVisits.map((visit) => (
              <PersonalJourneyVisitCard
                key={visit.id}
                visit={visit}
                onOpen={() =>
                  void navigate({
                    to: "/min-matresa/besok",
                    search: { visit: visit.id },
                    state: (previous) => previous,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl border-dashed p-5 text-sm text-muted-foreground">
            Besök från dina grupper visas här när de finns.
          </Card>
        )}
      </section>

      <PersonalJourneyReviewGroupDialog
        open={Boolean(reviewGroupChoice)}
        onOpenChange={(open) => {
          if (!open) setReviewGroupChoice(null);
        }}
        groups={reviewGroupChoice?.groups ?? []}
        onSelect={(group) => {
          if (!reviewGroupChoice) return;
          const item = reviewGroupChoice;
          setReviewGroupChoice(null);
          handoffPendingReview(item, group);
        }}
      />
    </div>
  );
}
