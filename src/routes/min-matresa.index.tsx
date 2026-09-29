import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Heart, MessageSquarePlus, RotateCcw, Star } from "lucide-react";
import {
  PersonalJourneyPlaceCard,
  PersonalJourneyVisitCard,
} from "@/components/matrundan/PersonalJourneyCards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appPageTitle } from "@/lib/app-environment";
import {
  loadPersonalJourneyOverview,
  type PersonalJourneyPendingReview,
} from "@/lib/matrundan/personal-journey";
import { DEMO_PERSONAL_JOURNEY_OVERVIEW } from "@/lib/matrundan/personal-journey-demo";
import { useSession } from "@/lib/matrundan/session";
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
  const { mode, selectGroup } = useSession();
  const overview = useQuery({
    queryKey: ["personal-journey", "overview", mode],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(DEMO_PERSONAL_JOURNEY_OVERVIEW)
        : loadPersonalJourneyOverview(),
  });

  function openPendingReview(item: PersonalJourneyPendingReview) {
    const target = item.groups.find((group) => group.isWritable);
    if (!target) return;
    selectGroup(target.groupId);
    void navigate({
      to: "/besok",
      search: { visit: item.visitId, group: target.groupId, from: "min-matresa" },
    });
  }

  if (overview.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-6 pt-3" aria-busy="true">
        <header>
          <h1 className="font-display text-3xl font-semibold">Min matresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Samlat från dina grupper.</p>
        </header>
        <Card className="animate-pulse rounded-2xl border-border/70 p-6 text-sm text-muted-foreground">
          Hämtar din matresa…
        </Card>
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-6 pt-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Min matresa kunde inte hämtas</h1>
        <p className="text-sm text-muted-foreground">Försök igen. Dina gruppdata påverkas inte.</p>
        <Button type="button" variant="outline" onClick={() => void overview.refetch()}>
          <RotateCcw className="h-4 w-4" /> Försök igen
        </Button>
      </div>
    );
  }

  const data = overview.data;
  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-6 pt-3">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Personligt</p>
        <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">Min matresa</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
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
      </header>

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
              const target = item.groups.find((group) => group.isWritable);
              return (
                <div
                  key={item.visitId}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium [overflow-wrap:anywhere]">{item.placeName}</div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatOwnVisitDate(item.visitedOn)} ·{" "}
                      {target?.groupName ?? "Arkiverad grupp"}
                    </p>
                  </div>
                  {target ? (
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
          <div className="mb-2 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <Star className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
              <h2 id="top-rated-places-heading" className="font-display text-xl font-semibold">
                Högst betyg i dina grupper
              </h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="ml-auto shrink-0 rounded-full">
              <Link to="/min-matresa/matstallen" search={{ sort: "rating" }}>
                Visa alla <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.topRatedPlaces.map((place) => (
              <PersonalJourneyPlaceCard
                key={place.id}
                place={place}
                onOpen={() =>
                  void navigate({
                    to: "/min-matresa/matstallen",
                    search: { place: place.id, sort: "rating" },
                  })
                }
              />
            ))}
          </div>
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
            <Link to="/min-matresa/besok">
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
                  void navigate({ to: "/min-matresa/besok", search: { visit: visit.id } })
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

      {data.favoritePlaces.length > 0 ? (
        <section aria-labelledby="favorite-places-heading">
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
              <h2 id="favorite-places-heading" className="font-display text-xl font-semibold">
                Mina favoriter
              </h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/min-matresa/matstallen" search={{ favorites: true }}>
                Visa alla <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.favoritePlaces.map((place) => (
              <PersonalJourneyPlaceCard
                key={place.id}
                place={place}
                onOpen={() =>
                  void navigate({
                    to: "/min-matresa/matstallen",
                    search: { place: place.id, favorites: true },
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
