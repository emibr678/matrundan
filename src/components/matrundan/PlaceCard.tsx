import { formatRating } from "@/lib/matrundan/version";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CATEGORY_LABEL, type Place, type PlaceCategory } from "@/lib/matrundan/types";
import { useStore } from "@/lib/matrundan/store";
import { RatingStars } from "./Rating";
import { StatusBadge } from "./StatusBadge";

const CATEGORY_GRADIENT: Record<PlaceCategory, string> = {
  restaurang: "from-primary/25 to-mustard/30",
  café: "from-mustard/35 to-secondary",
  bageri: "from-mustard/45 to-primary/15",
  snabbmat: "from-primary/20 to-sage/30",
  pub: "from-sage/40 to-secondary",
  matvagn: "from-sage/30 to-mustard/30",
};

export function PlaceThumb({
  place,
  size = "md",
}: {
  place: Place;
  size?: "sm" | "md" | "lg" | "detail";
}) {
  const dims =
    size === "detail"
      ? "h-16 w-16 text-3xl min-[390px]:h-20 min-[390px]:w-20 min-[390px]:text-4xl"
      : size === "lg"
        ? "h-20 w-20 text-4xl"
        : size === "sm"
          ? "h-11 w-11 text-2xl"
          : "h-14 w-14 text-3xl";
  return (
    <div
      data-slot="place-thumb"
      className={`relative grid ${dims} shrink-0 place-items-center overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${CATEGORY_GRADIENT[place.category]}`}
      aria-hidden="true"
    >
      <span className="drop-shadow-sm">{place.photo || "🍽️"}</span>
    </div>
  );
}

export function PlaceCard({ place, readOnly = false }: { place: Place; readOnly?: boolean }) {
  const { avgRating, isFavorite, toggleFavorite } = useStore();
  const rating = avgRating(place.id);
  const fav = isFavorite(place.id);

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        <PlaceThumb place={place} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              to="/matstallen/$placeId"
              params={{ placeId: place.id }}
              className="min-w-0 flex-1"
            >
              <h3 className="truncate font-display text-lg font-semibold leading-tight">
                {place.name}
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>{CATEGORY_LABEL[place.category]}</span>
                {place.cuisines.slice(0, 2).map((c) => (
                  <span key={c}>· {c}</span>
                ))}
              </div>
            </Link>
            {!readOnly ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  void toggleFavorite(place.id);
                }}
                className="h-11 w-11 shrink-0 rounded-full"
                aria-pressed={fav}
                aria-label={fav ? "Ta bort favorit" : "Markera som favorit"}
              >
                <Heart
                  className={
                    fav ? "h-4 w-4 fill-primary stroke-primary" : "h-4 w-4 stroke-muted-foreground"
                  }
                />
              </Button>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {rating.count > 0 ? (
                <>
                  <RatingStars value={rating.overall} size={14} />
                  <span className="text-xs text-muted-foreground">
                    {formatRating(rating.overall)} · {rating.count} besök
                  </span>
                </>
              ) : (
                <span className="text-xs italic text-muted-foreground">Inga besök än</span>
              )}
            </div>
            <StatusBadge placeId={place.id} />
          </div>

          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {place.address}, {place.city}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
