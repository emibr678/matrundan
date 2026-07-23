import * as React from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
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
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { CATEGORY_LABEL, OCCASION_LABEL } from "@/lib/matrundan/types";

export const Route = createFileRoute("/matstallen/$placeId")({
  head: () => ({
    meta: [
      { title: "Matställe · Matrundan" },
      { name: "description", content: "Detaljer, besök och betyg för ett matställe." },
      { property: "og:title", content: "Matställe · Matrundan" },
      { property: "og:description", content: "Detaljer, besök och betyg." },
    ],
  }),
  component: PlaceDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Stället hittades inte.</p>
      <Link to="/matstallen" className="mt-4 inline-block text-primary underline">
        Till matställen
      </Link>
    </div>
  ),
});

function PlaceDetail() {
  const { placeId } = useParams({ from: "/matstallen/$placeId" });
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

  if (!place) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Stället hittades inte.</p>
        <Link to="/matstallen" className="mt-4 inline-block text-primary underline">
          Till matställen
        </Link>
      </div>
    );
  }

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

  return (
    <div className="space-y-5 pt-2">
      <Link
        to="/matstallen"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Tillbaka
      </Link>

      <Card className="overflow-hidden rounded-3xl border-border/70 p-0">
        <div className="flex items-start gap-4 bg-gradient-to-br from-secondary to-secondary/40 p-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-background text-5xl shadow-sm">
            {place.photo ?? "🍽️"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABEL[place.category]}
            </div>
            <h1 className="font-display text-2xl font-semibold leading-tight">
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

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
          <Button
            onClick={() => setVisitOpen(true)}
            className="col-span-2 sm:col-span-1"
          >
            <Plus className="h-4 w-4" /> Besök
          </Button>
          <Button
            variant={isNext ? "secondary" : "outline"}
            onClick={() => setNext(isNext ? null : place.id)}
          >
            <Sparkles className="h-4 w-4" />
            {isNext ? "Är nästa" : "Nästa stopp"}
          </Button>
          <Button variant="outline" onClick={() => toggleFavorite(place.id)}>
            <Heart
              className={fav ? "h-4 w-4 fill-primary stroke-primary" : "h-4 w-4"}
            />
            {fav ? "Favorit" : "Spara"}
          </Button>
          <Button asChild variant="outline">
            <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Google Maps
            </a>
          </Button>
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
                <Card key={v.id} className="rounded-2xl border-border/70 p-3">
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
                            · {v.meal} · {formatDate(v.date)}
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
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <VisitDialog open={visitOpen} onOpenChange={setVisitOpen} placeId={place.id} />
    </div>
  );
}

function RatingCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">
        {value > 0 ? value.toFixed(1) : "–"}
      </div>
      <RatingStars value={value} size={11} className="mt-1 justify-center" />
    </div>
  );
}
