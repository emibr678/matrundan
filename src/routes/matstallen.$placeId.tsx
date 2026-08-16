import * as React from "react";
import {
  createFileRoute,
  Link,
  stripSearchParams,
  useNavigate,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, Flag, Heart, ListX, MessageCircle, Plus, UsersRound } from "lucide-react";
import { z } from "zod";
import { PlaceAdminDialog } from "@/components/matrundan/PlaceAdminDialog";
import { PlaceDataReportDialog } from "@/components/matrundan/PlaceDataReportDialog";
import {
  PlacePracticalInfoPanel,
  PlacePracticalInfoProvider,
} from "@/components/matrundan/PlacePracticalInfo";
import { OccasionGuide } from "@/components/matrundan/OccasionPicker";
import { PlaceThumb } from "@/components/matrundan/PlaceCard";
import { RatingStars } from "@/components/matrundan/Rating";
import { VisitDetailSheet } from "@/components/matrundan/VisitDetailSheet";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { normalizeOccasionClassification } from "@/lib/matrundan/occasions";
import { getAttentionPendingVisitReviews } from "@/lib/matrundan/pending-visit-reviews";
import { formatDate, useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, OCCASION_DESCRIPTION, OCCASION_LABEL } from "@/lib/matrundan/types";
import { formatRating } from "@/lib/matrundan/version";

const MEAL_LABEL: Record<string, string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

const PLACE_SEARCH_DEFAULTS = { visit: "" };

const placeSearchSchema = z.object({
  visit: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/matstallen/$placeId")({
  validateSearch: zodValidator(placeSearchSchema),
  search: {
    middlewares: [stripSearchParams(PLACE_SEARCH_DEFAULTS)],
  },
  head: () => ({
    meta: [
      { title: "Matställe · Matrundan" },
      {
        name: "description",
        content: "Detaljer, besök och betyg för ett matställe.",
      },
      { property: "og:title", content: "Matställe · Matrundan" },
      { property: "og:description", content: "Detaljer, besök och betyg." },
    ],
  }),
  component: PlaceDetail,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Stället hittades inte.</p>
      <Link to="/matstallen" className="mt-4 inline-block text-primary underline">
        Till matställen
      </Link>
    </div>
  );
}

function PlaceDetail() {
  const { placeId } = useParams({ from: "/matstallen/$placeId" });
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/matstallen/$placeId" });
  const router = useRouter();
  const {
    getPlace,
    visitsFor,
    avgRating,
    isFavorite,
    toggleFavorite,
    setNext,
    state,
    demoReadOnly,
    memberById,
  } = useStore();
  const place = getPlace(placeId);
  const [visitOpen, setVisitOpen] = React.useState(false);
  const openVisitId = search.visit || null;
  const closeVisitSheet = () => navigate({ params: { placeId }, search: { visit: "" } });

  const visits = React.useMemo(() => (place ? visitsFor(place.id) : []), [place, visitsFor]);
  const pendingReviewVisits = React.useMemo(
    () => getAttentionPendingVisitReviews(visits, state.currentUserId),
    [state.currentUserId, visits],
  );
  const pendingReviewVisitIds = React.useMemo(
    () => new Set(pendingReviewVisits.map((visit) => visit.id)),
    [pendingReviewVisits],
  );
  const nextPendingReviewVisit = pendingReviewVisits[0] ?? null;
  const detail = React.useMemo(() => {
    const taste: number[] = [];
    const value: number[] = [];
    const service: number[] = [];
    visits.forEach((visit) => {
      if (visit.taste) taste.push(visit.taste);
      if (visit.value) value.push(visit.value);
      if (visit.service) service.push(visit.service);
    });
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
    return {
      taste: avg(taste),
      value: avg(value),
      service: avg(service),
    };
  }, [visits]);

  if (!place) return <NotFound />;

  const rating = avgRating(place.id);
  const occasions = normalizeOccasionClassification(place.occasions);
  const fav = isFavorite(place.id);
  const isNext = state.nextPlaceId === place.id;
  const groupArchived = state.group.lifecycleStatus === "archived";
  const placeRemoved = place.collectionStatus === "archived";
  const writable = !groupArchived && !placeRemoved && !demoReadOnly;
  const canCompleteReview = !groupArchived && !demoReadOnly;
  const latestVisit = visits[0] ?? null;
  const latestParticipantNames = latestVisit
    ? Array.from(
        new Set(
          latestVisit.participants?.length
            ? latestVisit.participants
                .filter((participant) => participant.status !== "guest")
                .map((participant) => participant.name)
            : latestVisit.participantIds
                .map((participantId) => memberById(participantId)?.name)
                .filter((name): name is string => Boolean(name)),
        ),
      )
    : [];
  const latestParticipantSummary = latestParticipantNames.length
    ? `${latestParticipantNames.slice(0, 2).join(", ")}${
        latestParticipantNames.length > 2 ? ` +${latestParticipantNames.length - 2}` : ""
      }`
    : null;

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/matstallen" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-2 md:max-w-3xl">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={goBack}
          className="-ml-2 h-11 min-w-11 gap-1 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
          aria-label="Gå tillbaka till matställen"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Button>
        {writable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void toggleFavorite(place.id)}
            aria-pressed={fav}
            aria-label={fav ? "Ta bort favorit" : "Markera som favorit"}
            className="h-11 w-11 shrink-0 rounded-full border border-border/70 bg-background/70 shadow-sm backdrop-blur hover:bg-background"
          >
            <Heart
              className={fav ? "h-5 w-5 fill-primary stroke-primary" : "h-5 w-5 text-foreground"}
            />
          </Button>
        ) : null}
      </div>

      <PlacePracticalInfoProvider place={place} groupId={state.group.id} canReport={writable}>
        <Card
          data-next-stop={isNext ? "true" : "false"}
          className="relative overflow-hidden rounded-3xl border-border/70 p-0"
        >
          <div className="bg-gradient-to-br from-secondary to-secondary/40 p-4 sm:p-5">
            <div
              data-testid="place-identity-grid"
              className="grid min-h-16 grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 min-[390px]:min-h-20 min-[390px]:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-4"
            >
              <PlaceThumb place={place} size="detail" />
              <div className="min-w-0 self-center">
                <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  {CATEGORY_LABEL[place.category]}
                </div>
                <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">
                  {place.name}
                </h1>
              </div>
            </div>

            {placeRemoved ? (
              <div className="mt-3">
                <Badge variant="outline" className="whitespace-normal rounded-2xl text-left">
                  <ListX className="mr-1 h-3 w-3 shrink-0" /> Inte längre i gruppens lista
                </Badge>
              </div>
            ) : null}

            <PlacePracticalInfoPanel />
          </div>

          {latestVisit ? (
            <div className="border-t border-border/60 bg-background/60 px-4 py-3 sm:px-5">
              <div className="flex items-start gap-2.5">
                <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {rating.count > 0 ? (
                      <>
                        <RatingStars value={rating.overall} size={13} />
                        <span className="font-medium">{formatRating(rating.overall)}</span>
                        <span aria-hidden="true" className="text-muted-foreground">
                          ·
                        </span>
                      </>
                    ) : null}
                    <span className="font-medium">{visits.length} besök</span>
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Senast {formatDate(latestVisit.date)}
                    {latestParticipantSummary ? ` · ${latestParticipantSummary}` : ""}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={latestVisit ? "space-y-2 p-4" : "space-y-2 border-t border-border/60 p-4"}
          >
            {canCompleteReview && nextPendingReviewVisit ? (
              <div
                aria-label="Omdöme att komplettera på matstället"
                className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {pendingReviewVisits.length === 1
                        ? "Ditt omdöme saknas"
                        : `${pendingReviewVisits.length} besök här väntar på ditt omdöme`}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {pendingReviewVisits.length === 1
                        ? `Från besöket ${formatDate(nextPendingReviewVisit.date)}.`
                        : `Öppna det senaste, från ${formatDate(nextPendingReviewVisit.date)}.`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-11"
                  onClick={() =>
                    navigate({
                      params: { placeId },
                      search: { visit: nextPendingReviewVisit.id },
                    })
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                  Lämna omdöme
                </Button>
              </div>
            ) : null}

            {writable ? (
              <>
                <Button
                  size="lg"
                  onClick={() => setVisitOpen(true)}
                  className="h-12 w-full text-base"
                >
                  <Plus className="h-4 w-4" />
                  {visits.length > 0 ? "Registrera besök igen" : "Registrera besök"}
                </Button>
                {isNext ? (
                  <Button
                    variant="secondary"
                    aria-pressed="true"
                    aria-label={`Ta bort ${place.name} som nästa stopp`}
                    onClick={() => void setNext(null)}
                    className="min-h-11 w-full justify-between gap-3 whitespace-normal px-4"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <Flag className="h-4 w-4 shrink-0" />
                      <span>Nästa stopp</span>
                    </span>
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      Ta bort
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    aria-pressed="false"
                    onClick={() => void setNext(place.id)}
                    className="min-h-11 w-full whitespace-normal"
                  >
                    <Flag className="h-4 w-4 shrink-0" />
                    Föreslå som nästa stopp
                  </Button>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-3 text-sm">
                <div className="font-medium">
                  {demoReadOnly
                    ? "Skrivskyddad exempelgrupp"
                    : placeRemoved
                      ? "Inte längre i gruppens lista"
                      : "Gruppen är arkiverad"}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {demoReadOnly
                    ? "Du kan utforska stället och gruppens påhittade besök, men inte ändra exempeldata."
                    : `Tidigare besök, betyg, kommentarer och favoriter finns kvar.${
                        placeRemoved && !groupArchived
                          ? " En ägare eller admin kan lägga tillbaka stället för nya besök och planering."
                          : " Återaktivera gruppen för att göra ändringar."
                      }`}
                </p>
              </div>
            )}
          </div>
        </Card>
      </PlacePracticalInfoProvider>

      <section>
        <h2 className="mb-2 font-display text-lg">
          {visits.length > 0 ? `Besök (${visits.length})` : "Besök"}
        </h2>
        {visits.length === 0 ? (
          <Card className="rounded-2xl border-dashed bg-transparent px-4 py-3 text-center shadow-none">
            <p className="text-xs leading-5 text-muted-foreground">
              {writable ? "Ingen har varit här än." : "Inga registrerade besök finns i historiken."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {visits.map((visit) => {
              const author = memberById(visit.createdBy);
              const pendingReview = canCompleteReview && pendingReviewVisitIds.has(visit.id);
              const visibleParticipants =
                visit.participants && visit.participants.length > 0
                  ? visit.participants
                  : visit.participantIds.map((participantId) => {
                      const member = memberById(participantId);
                      return {
                        id: participantId,
                        name: member?.name ?? "Okänd",
                        avatar: member?.avatar ?? null,
                        avatarImage: member?.avatarImage ?? null,
                        status: "active" as const,
                      };
                    });
              return (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() =>
                    navigate({
                      params: { placeId },
                      search: { visit: visit.id },
                    })
                  }
                  className="w-full rounded-2xl border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`Öppna besök av ${author?.name ?? "medlem"} ${formatDate(
                    visit.date,
                  )}`}
                >
                  <div className="flex items-start gap-3">
                    {visit.photo?.url ? (
                      <img
                        src={visit.photo.url}
                        alt=""
                        className="h-16 w-20 shrink-0 rounded-xl border border-border/70 object-cover"
                      />
                    ) : (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">
                        {author?.avatar ?? "🙂"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{author?.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {MEAL_LABEL[visit.meal] ?? visit.meal} · {formatDate(visit.date)}
                          </span>
                        </div>
                        <RatingStars value={visit.overall} size={12} />
                      </div>
                      {pendingReview ? (
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Ditt omdöme saknas</span>
                        </div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {visibleParticipants.map((participant) => (
                          <span
                            key={participant.id}
                            className="rounded-full bg-secondary px-2 py-0.5 text-[11px]"
                          >
                            {participant.avatar ?? "🙂"} {participant.name}
                            {participant.status === "guest" ? " · Gäst" : ""}
                          </span>
                        ))}
                        {(visit.externalParticipantCount ?? 0) > 0 ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            +{visit.externalParticipantCount} utanför gruppen
                          </span>
                        ) : null}
                      </div>
                      {visit.comment ? (
                        <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{visit.comment}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="min-w-0 font-display text-lg">Om stället</h2>
          {!demoReadOnly ? <PlaceAdminDialog place={place} /> : null}
        </div>
        <Card className="space-y-3 rounded-2xl border-border/70 p-4">
          {place.cuisines.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {place.cuisines.map((cuisine) => (
                <Badge key={cuisine} variant="secondary" className="rounded-full">
                  {cuisine}
                </Badge>
              ))}
            </div>
          ) : null}
          {occasions.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex min-h-11 items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">Passar för</span>
                <OccasionGuide compact />
              </div>
              <div className="flex flex-wrap gap-2">
                {occasions.map((occasion) => (
                  <Badge
                    key={occasion}
                    variant="outline"
                    title={OCCASION_DESCRIPTION[occasion]}
                    className="rounded-full border-mustard/60 bg-mustard/25 text-mustard-foreground"
                  >
                    {OCCASION_LABEL[occasion]}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {place.notes ? <p className="text-sm text-muted-foreground">{place.notes}</p> : null}
          {(place.categoryOverride != null || place.cuisinesOverride != null) && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Kategori eller kök och inriktning har anpassats för den här gruppen. Matställets namn
              och adress är oförändrade.
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Tillagt av {memberById(place.addedBy)?.name ?? "någon"} · {formatDate(place.addedAt)}
          </div>
        </Card>
      </section>

      {rating.count > 0 ? (
        <section>
          <h2 className="mb-2 font-display text-lg">Betygsdetaljer</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Frivilliga snitt per aspekt – syns bara när gänget har lämnat dem.
          </p>
          <Card className="grid grid-cols-3 gap-3 rounded-2xl border-border/70 p-4">
            <RatingCell label="Smak" value={detail.taste} />
            <RatingCell label="Prisvärd" value={detail.value} />
            <RatingCell label="Service" value={detail.service} />
          </Card>
        </section>
      ) : null}

      {!demoReadOnly && !groupArchived ? (
        <div className="pt-1">
          <PlaceDataReportDialog place={place} triggerLabel="Rapportera felaktig information" />
        </div>
      ) : null}

      {writable ? (
        <VisitDialog open={visitOpen} onOpenChange={setVisitOpen} placeId={place.id} />
      ) : null}
      <VisitDetailSheet
        visitId={openVisitId}
        open={!!openVisitId}
        onOpenChange={(open) => !open && closeVisitSheet()}
      />
    </div>
  );
}

function RatingCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">
        {value > 0 ? formatRating(value) : "–"}
      </div>
      <RatingStars value={value} size={11} className="mt-1 justify-center" />
    </div>
  );
}
