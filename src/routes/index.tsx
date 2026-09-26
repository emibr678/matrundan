import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Heart, Plus, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { appPageTitle } from "@/lib/app-environment";
import { useStore } from "@/lib/matrundan/store";
import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { NextStopCard } from "@/components/matrundan/NextStopCard";
import { AppNudges } from "@/components/matrundan/AppNudges";
import { PendingVisitReviewCard } from "@/components/matrundan/PendingVisitReviewCard";
import { getAttentionPendingVisitReviews } from "@/lib/matrundan/pending-visit-reviews";
import { effectiveReviewOverall } from "@/lib/matrundan/review-model";
import type { VisibleReview } from "@/lib/matrundan/types";
import { formatRating } from "@/lib/matrundan/version";
import { useSession } from "@/lib/matrundan/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: appPageTitle("Hem") },
      {
        name: "description",
        content: "Se gruppens nästa stopp och gemensamma framsteg på ett ställe.",
      },
      { property: "og:title", content: appPageTitle("Hem") },
      {
        property: "og:description",
        content: "Nästa stopp och gruppens gemensamma matresa.",
      },
    ],
  }),
  component: Home,
});

export function Home() {
  const { state, demoReadOnly, getPlace, memberById } = useStore();
  const { pendingGroupInvitations } = useSession();
  const [addOpen, setAddOpen] = React.useState(false);
  const [visitTarget, setVisitTarget] = React.useState<{
    placeId: string;
    completeNextStopOnSave: boolean;
  } | null>(null);
  const groupArchived = state.group.lifecycleStatus === "archived";
  const canWrite = !groupArchived && !demoReadOnly;
  const activePlaces = React.useMemo(
    () => state.places.filter((place) => place.collectionStatus !== "archived"),
    [state.places],
  );
  const pendingReviewVisits = React.useMemo(
    () =>
      groupArchived
        ? []
        : getAttentionPendingVisitReviews(state.visits, state.currentUserId, new Date()),
    [groupArchived, state.currentUserId, state.visits],
  );
  const pendingReviewVisit = pendingReviewVisits[0];
  const pendingReviewPlace = pendingReviewVisit ? getPlace(pendingReviewVisit.placeId) : undefined;

  const untried = React.useMemo(
    () => activePlaces.filter((place) => !state.visits.some((visit) => visit.placeId === place.id)),
    [activePlaces, state.visits],
  );

  const totalPlaces = activePlaces.length;
  const tried = totalPlaces - untried.length;
  const progressPct = totalPlaces === 0 ? 0 : Math.round((tried / totalPlaces) * 100);
  const progressNote =
    totalPlaces === 0
      ? "Er runda börjar med det första stället ni lägger till."
      : untried.length === 0
        ? "Hela listan är avklarad — dags att fylla på med nya smultronställen."
        : untried.length === 1
          ? "Ett ställe kvar innan ni har provat hela listan."
          : "Ett ställe räknas som provat så fort någon i gänget varit där.";

  const lastVisit = React.useMemo(() => {
    return [...state.visits].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [state.visits]);
  const lastVisitPlace = lastVisit ? getPlace(lastVisit.placeId) : undefined;
  const lastVisitNames = lastVisit
    ? lastVisit.participants && lastVisit.participants.length > 0
      ? lastVisit.participants.map((participant) => participant.name)
      : lastVisit.participantIds
          .map((id) => memberById(id)?.name)
          .filter((name): name is string => Boolean(name))
    : [];
  const lastVisitParticipantSummary = lastVisit
    ? [
        ...lastVisitNames,
        (lastVisit.externalParticipantCount ?? 0) > 0
          ? `+${lastVisit.externalParticipantCount} utanför gruppen`
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(", ")
    : "";
  const lastVisitReview = React.useMemo(() => {
    if (!lastVisit) return undefined;
    return (lastVisit.visibleReviews ?? []).find(
      (review): review is VisibleReview & { overall: number } =>
        review.userId !== state.currentUserId &&
        review.ratingVisible &&
        review.overall != null &&
        review.commentVisible &&
        Boolean(review.comment?.trim()),
    );
  }, [lastVisit, state.currentUserId]);
  const lastVisitReviewOverall =
    lastVisitReview && lastVisit
      ? effectiveReviewOverall(lastVisitReview, lastVisit.isTakeaway === true)
      : null;
  const lastVisitReviewAuthor = lastVisitReview
    ? (lastVisit?.participants?.find((participant) => participant.id === lastVisitReview.userId)
        ?.name ?? memberById(lastVisitReview.userId)?.name)
    : undefined;
  const pendingInvitationTitle =
    pendingGroupInvitations.length === 1
      ? "Du har en gruppinbjudan"
      : `Du har ${pendingGroupInvitations.length} gruppinbjudningar`;
  const pendingInvitationDescription =
    pendingGroupInvitations.length === 1
      ? `${pendingGroupInvitations[0]?.invited_by_name || "En medlem"} har bjudit in dig till ${pendingGroupInvitations[0]?.group_name}.`
      : "Öppna för att välja vilka grupper du vill gå med i.";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-2 md:max-w-3xl">
      <AppNudges />

      {pendingGroupInvitations.length > 0 ? (
        <section aria-label="Gruppinbjudningar">
          <Card className="rounded-2xl border-primary/25 bg-primary/[0.05] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserPlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="font-medium">{pendingInvitationTitle}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {pendingInvitationDescription}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full shrink-0 sm:w-auto"
                onClick={() => {
                  window.dispatchEvent(new Event("matrundan:open-group-invitations"));
                }}
              >
                {pendingGroupInvitations.length === 1 ? "Visa inbjudan" : "Visa inbjudningar"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </section>
      ) : null}

      <NextStopCard
        activePlaces={activePlaces}
        canWrite={canWrite}
        onRegisterVisit={(placeId) => setVisitTarget({ placeId, completeNextStopOnSave: true })}
      />

      {pendingReviewVisit && pendingReviewPlace ? (
        <section aria-label="Omdömen att komplettera">
          <PendingVisitReviewCard
            visitId={pendingReviewVisit.id}
            placeName={pendingReviewPlace.name}
            visitDate={pendingReviewVisit.date}
            pendingCount={pendingReviewVisits.length}
          />
        </section>
      ) : null}

      <section>
        <Card className="rounded-2xl border-border/70 p-4">
          <div className="mb-2 text-sm font-medium">
            Ni har provat {tried} av {totalPlaces} ställen tillsammans
          </div>
          <Progress value={progressPct} className="h-2" />
          {progressNote ? (
            <p className="mt-2 text-xs text-muted-foreground">{progressNote}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile label="Ställen" value={totalPlaces} />
            <StatTile label="Besök" value={state.visits.length} />
            <StatTile label="Kvar att prova" value={untried.length} tone="mustard" />
          </div>
        </Card>
      </section>

      {lastVisit && lastVisitPlace ? (
        <section>
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              <Heart className="h-3.5 w-3.5" />
              Senast tillsammans
            </div>
            <Link
              to="/besok"
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-medium text-primary hover:underline"
            >
              Alla besök <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Link
            to="/besok"
            search={{ visit: lastVisit.id, review: lastVisitReview?.id }}
            className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={
              lastVisitReview && lastVisitReviewAuthor
                ? `Öppna omdömet från ${lastVisitReviewAuthor} om ${lastVisitPlace.name}`
                : `Öppna besöket på ${lastVisitPlace.name}`
            }
          >
            <Card className="rounded-2xl border-border/70 p-4 transition-colors hover:bg-accent/35">
              <div className="font-display text-lg [overflow-wrap:anywhere]">
                {lastVisitPlace.name}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(lastVisit.date).toLocaleDateString("sv-SE", {
                  day: "numeric",
                  month: "long",
                })}
                {lastVisitParticipantSummary ? ` · ${lastVisitParticipantSummary}` : ""}
              </p>
              {lastVisitReview && lastVisitReviewOverall != null ? (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {lastVisitReviewAuthor ?? "Deltagare"}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatRating(lastVisitReviewOverall)} / 5
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm [overflow-wrap:anywhere]">
                    ”{lastVisitReview.comment?.trim()}”
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Öppna omdömet <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              ) : lastVisit.comment ? (
                <p className="mt-2 text-sm [overflow-wrap:anywhere]">”{lastVisit.comment}”</p>
              ) : null}
            </Card>
          </Link>
        </section>
      ) : null}

      <section className={canWrite ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
        {canWrite ? (
          <Button
            variant="outline"
            size="lg"
            className="h-14 rounded-2xl"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Lägg till ställe
          </Button>
        ) : null}
        <Button asChild variant="outline" size="lg" className="h-14 rounded-2xl">
          <Link to="/matstallen">
            <Star className="h-4 w-4" /> Bläddra listan
          </Link>
        </Button>
      </section>

      {canWrite ? (
        <>
          <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} />
          <VisitDialog
            open={visitTarget !== null}
            onOpenChange={(open) => !open && setVisitTarget(null)}
            placeId={visitTarget?.placeId ?? null}
            completeNextStopOnSave={visitTarget?.completeNextStopOnSave ?? false}
          />
        </>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "mustard";
}) {
  return (
    <div
      className={[
        "rounded-xl border border-border/70 p-3 text-center",
        tone === "mustard" ? "bg-mustard/25" : "bg-card",
      ].join(" ")}
    >
      <div className="font-display text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
