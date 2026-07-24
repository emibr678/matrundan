import * as React from "react";
import {
  createFileRoute,
  Link,
  useParams,
  useRouter,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  ArrowLeft,
  Heart,
  MapPin,
  ExternalLink,
  Sparkles,
  Plus,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore, formatDate, googleMapsUrl } from "@/lib/matrundan/store";
import { RatingStars } from "@/components/matrundan/Rating";
import { StatusBadge } from "@/components/matrundan/StatusBadge";
import { PlaceThumb } from "@/components/matrundan/PlaceCard";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { VisitDetailSheet } from "@/components/matrundan/VisitDetailSheet";
import { CATEGORY_LABEL, OCCASION_LABEL } from "@/lib/matrundan/types";

const MEAL_LABEL: Record<string, string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

const placeSearchSchema = z.object({
  visit: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/matstallen/$placeId")({
  validateSearch: zodValidator(placeSearchSchema),
  head: () => ({
    meta: [
      { title: "Matställe · Matrundan" },
      { name: "description", content: "Detaljer, besök och betyg för ett matställe." },
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
    memberById,
  } = useStore();
  const place = getPlace(placeId);
  const [visitOpen, setVisitOpen] = React.useState(false);
  const openVisitId = search.visit || null;
  const closeVisitSheet = () =>
    navigate({ params: { placeId }, search: { visit: "" } });

  if (!place) return <NotFound />;

  const rating = avgRating(place.id);
  const visits = visitsFor(place.id);
  const fav = isFavorite(place.id);
  const isNext = state.nextPlaceId === place.id;

  const detail = React.useMemo(() => {
    const t: number[] = [];
    const v: number[] = [];
    const s: number[] = [];
    visits.forEach((visit) => {
      if (visit.taste) t.push(visit.taste);
      if (visit.value) v.push(visit.value);
      if (visit.service) s.push(visit.service);
    });
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
    return { taste: avg(t), value: avg(v), service: avg(s) };
  }, [visits]);

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
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">
                {place.address}, {place.city}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge placeId={place.id} />
              {rating.count > 0 ? (
                <div className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-0.5 text-xs">
                  <RatingStars value={rating.overall} size={12} />
                  <span className="font-medium">{rating.overall.toFixed(1)}</span>
                  <span className="text-muted-foreground">· {rating.count}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2 p-4">
          <Button
            size="lg"
            onClick={() => setVisitOpen(true)}
            className="h-12 w-full text-base"
          >
            <Plus className="h-4 w-4" /> Registrera besök
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={isNext ? "secondary" : "outline"}
              onClick={() => setNext(isNext ? null : place.id)}
              aria-pressed={isNext}
              className="min-h-11"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isNext ? "Är nästa" : "Nästa stopp"}
              </span>
              <span className="sm:hidden">{isNext ? "Nästa" : "Nästa"}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => toggleFavorite(place.id)}
              aria-pressed={fav}
              className="min-h-11"
            >
              <Heart
                className={fav ? "h-4 w-4 fill-primary stroke-primary" : "h-4 w-4"}
              />
              {fav ? "Sparad" : "Spara"}
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Maps
              </a>
            </Button>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 font-display text-lg">Om stället</h2>
        <Card className="space-y-3 rounded-2xl border-border/70 p-4">
          <div className="flex flex-wrap gap-1.5">
            {place.cuisines.map((c) => (
              <Badge key={c} variant="secondary" className="rounded-full">
                {c}
              </Badge>
            ))}
            {place.occasions.map((o) => (
              <Badge
                key={o}
                variant="outline"
                className="rounded-full border-mustard/60 bg-mustard/25 text-mustard-foreground"
              >
                {OCCASION_LABEL[o]}
              </Badge>
            ))}
          </div>
          {place.notes ? (
            <p className="text-sm text-muted-foreground">{place.notes}</p>
          ) : null}
          <div className="text-xs text-muted-foreground">
            Tillagt av {memberById(place.addedBy)?.name ?? "någon"} ·{" "}
            {formatDate(place.addedAt)}
          </div>
        </Card>
      </section>

      {rating.count > 0 ? (
        <section>
          <h2 className="mb-2 font-display text-lg">Gruppens betyg</h2>
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
              Inga besök än. Bli först i gänget.
            </p>
            <Button className="mt-3" onClick={() => setVisitOpen(true)}>
              <Plus className="h-4 w-4" /> Registrera besök
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => {
              const author = memberById(v.createdBy);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() =>
                    navigate({ params: { placeId }, search: { visit: v.id } })
                  }
                  className="w-full rounded-2xl border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`Öppna besök av ${author?.name ?? "medlem"} ${formatDate(v.date)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">
                      {author?.avatar ?? "🙂"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{author?.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {MEAL_LABEL[v.meal] ?? v.meal} · {formatDate(v.date)}
                          </span>
                        </div>
                        <RatingStars value={v.overall} size={12} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {v.participantIds.map((pid) => {
                          const m = memberById(pid);
                          return (
                            <span
                              key={pid}
                              className="rounded-full bg-secondary px-2 py-0.5 text-[11px]"
                            >
                              {m?.avatar} {m?.name}
                            </span>
                          );
                        })}
                      </div>
                      {v.comment ? (
                        <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{v.comment}</span>
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

      <VisitDialog open={visitOpen} onOpenChange={setVisitOpen} placeId={place.id} />
      <VisitDetailSheet
        visitId={openVisitId}
        open={!!openVisitId}
        onOpenChange={(o) => !o && closeVisitSheet()}
      />
    </div>
  );
}

function RatingCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">
        {value > 0 ? value.toFixed(1) : "–"}
      </div>
      <RatingStars value={value} size={11} className="mt-1 justify-center" />
    </div>
  );
}
