import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Heart, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/matrundan/store";
import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { NextStopCard } from "@/components/matrundan/NextStopDateCard";
import { AppNudges } from "@/components/matrundan/AppNudges";
import { PendingVisitReviewCard } from "@/components/matrundan/PendingVisitReviewCard";
import { getAttentionPendingVisitReviews } from "@/lib/matrundan/pending-visit-reviews";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hem · Matrundan" },
      {
        name: "description",
        content: "Se gruppens nästa stopp och gemensamma framsteg på ett ställe.",
      },
      { property: "og:title", content: "Hem · Matrundan" },
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
  const [addOpen, setAddOpen] = React.useState(false);
  const [visitPlace, setVisitPlace] = React.useState<string | null>(null);
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-2 md:max-w-3xl">
      <AppNudges />

      <NextStopCard
        activePlaces={activePlaces}
        canWrite={canWrite}
        onRegisterVisit={setVisitPlace}
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
            search={{ visit: lastVisit.id }}
            className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Öppna besöket på ${lastVisitPlace.name}`}
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
              {lastVisit.comment ? (
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
            open={visitPlace !== null}
            onOpenChange={(open) => !open && setVisitPlace(null)}
            placeId={visitPlace}
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
