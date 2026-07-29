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
import {
  ArrowLeft,
  ExternalLink,
  Flag,
  Heart,
  ListX,
  MapPin,
  MessageCircle,
  Plus,
} from "lucide-react";
import { z } from "zod";
import { PlaceAdminDialog } from "@/components/matrundan/PlaceAdminDialog";
import { PlaceThumb } from "@/components/matrundan/PlaceCard";
import { RatingStars } from "@/components/matrundan/Rating";
import { StatusBadge } from "@/components/matrundan/StatusBadge";
import { VisitDetailSheet } from "@/components/matrundan/VisitDetailSheet";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, googleMapsUrl, useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, OCCASION_LABEL } from "@/lib/matrundan/types";
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

  const visits = place ? visitsFor(place.id) : [];
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
  const fav = isFavorite(place.id);
  const isNext = state.nextPlaceId === place.id;
  const groupArchived = state.group.lifecycleStatus === "archived";
  const placeRemoved = place.collectionStatus === "archived";
  const writable = !groupArchived && !placeRemoved && !demoReadOnly;

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/matstallen" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-2 md:max-w-3xl">
      <Button
        variant="ghost"
        onClick={goBack}
        className="-ml-2 h-11 min-w-11 gap-1 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
        aria-label="Gå tillbaka till matställen"
      >
        <ArrowLeft className="h-4 w-4" /> Tillbaka
      </Button>

      <Card className="overflow-hidden rounded-3xl border-border/70 p-0">
        <div className="flex items-start gap-4 bg-gradient-to-br from-secondary to-secondary/40 p-5">
          <PlaceThumb place={place} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {CATEGORY_LABEL[place.category]}
            </div>
            <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">
              {place.name}
            </h1>
            <div className="mt-1 flex max-w-full items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {place.address}, {place.city}
              </span>
            </div>
            <a
              href={googleMapsUrl(place)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              aria-label={`Öppna ${place.name} i Google Maps`}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              Öppna i Google Maps
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isNext ? (
                <Badge variant="secondary" className="rounded-full">
                  <Flag className="mr-1 h-3 w-3" /> Nästa stopp
                </Badge>
              ) : null}
              {placeRemoved ? (
                <Badge variant="outline" className="rounded-full">
                  <ListX className="mr-1 h-3 w-3" /> Inte längre i gruppens lista
                </Badge>
              ) : (
                <StatusBadge placeId={place.id} />
              )}
            </div>
          </div>
        </div>

        {rating.count > 0 ? (
          <div className="flex items-center gap-4 border-t border-border/60 bg-background/60 px-5 py-4">
            <div className="text-center">
              <div className="font-display text-3xl font-semibold leading-none">
                {formatRating(rating.overall)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">av 5</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium tracking-wide text-muted-foreground">
                Gruppens helhetsbetyg
              </div>
              <RatingStars value={rating.overall} size={16} className="mt-0.5" />
              <div className="mt-0.5 text-xs text-muted-foreground">
                {rating.count} betyg från gänget
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2 p-4">
          {writable ? (
            <>
              <Button
                size="lg"
                onClick={() => setVisitOpen(true)}
                className="h-12 w-full text-base"
              >
                <Plus className="h-4 w-4" /> Registrera besök
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                {isNext ? (
                  <Button
                    variant="ghost"
                    onClick={() => void setNext(null)}
                    className="min-h-11 text-muted-foreground"
                  >
                    Ta bort som nästa stopp
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void setNext(place.id)}
                    className="min-h-11"
                  >
                    <Flag className="h-4 w-4" />
                    Välj som nästa stopp
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => void toggleFavorite(place.id)}
                  aria-pressed={fav}
                  aria-label={fav ? "Ta bort favorit" : "Markera som favorit"}
                  className="min-h-11"
                >
                  <Heart className={fav ? "h-4 w-4 fill-primary stroke-primary" : "h-4 w-4"} />
                  Favorit
                </Button>
              </div>
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
                  ? "Du kan utforska stället och gruppens fiktiva besök, men inte ändra exempeldata."
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

      <section>
        <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
          <h2 className="font-display text-lg">Om stället</h2>
          {!demoReadOnly ? <PlaceAdminDialog place={place} /> : null}
        </div>
        <Card className="space-y-3 rounded-2xl border-border/70 p-4">
          <div className="flex flex-wrap gap-1.5">
            {place.cuisines.map((cuisine) => (
              <Badge key={cuisine} variant="secondary" className="rounded-full">
                {cuisine}
              </Badge>
            ))}
            {place.occasions.map((occasion) => (
              <Badge
                key={occasion}
                variant="outline"
                className="rounded-full border-mustard/60 bg-mustard/25 text-mustard-foreground"
              >
                {OCCASION_LABEL[occasion]}
              </Badge>
            ))}
          </div>
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

      <section className="pb-4">
        <h2 className="mb-2 font-display text-lg">Besök ({visits.length})</h2>
        {visits.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-6 text-center">
            <div className="text-4xl">✨</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {writable
                ? "Inga besök än. Bli först i gänget."
                : "Inga registrerade besök finns i historiken."}
            </p>
            {writable ? (
              <Button className="mt-3" onClick={() => setVisitOpen(true)}>
                <Plus className="h-4 w-4" /> Registrera besök
              </Button>
            ) : null}
          </Card>
        ) : (
          <div className="space-y-2">
            {visits.map((visit) => {
              const author = memberById(visit.createdBy);
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
                  aria-label={`Öppna besök av ${
                    author?.name ?? "medlem"
                  } ${formatDate(visit.date)}`}
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
                      <div className="mt-1 flex flex-wrap gap-1">
                        {visit.participantIds.map((participantId) => {
                          const member = memberById(participantId);
                          return (
                            <span
                              key={participantId}
                              className="rounded-full bg-secondary px-2 py-0.5 text-[11px]"
                            >
                              {member?.avatar} {member?.name}
                            </span>
                          );
                        })}
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
