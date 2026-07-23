import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CATEGORY_LABEL, type Place } from "@/lib/matrundan/types";
import { useStore } from "@/lib/matrundan/store";
import { RatingStars } from "./Rating";
import { StatusBadge } from "./StatusBadge";

export function PlaceCard({ place }: { place: Place }) {
  const { avgRating, isFavorite, toggleFavorite } = useStore();
  const rating = avgRating(place.id);
  const fav = isFavorite(place.id);

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary text-3xl">
          {place.photo ?? "🍽️"}
        </div>
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
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(place.id);
              }}
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label={fav ? "Ta bort favorit" : "Spara som favorit"}
            >
              <Heart
                className={
                  fav
                    ? "h-4 w-4 fill-primary stroke-primary"
                    : "h-4 w-4 stroke-muted-foreground"
                }
              />
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {rating.count > 0 ? (
                <>
                  <RatingStars value={rating.overall} size={14} />
                  <span className="text-xs text-muted-foreground">
                    {rating.overall.toFixed(1)} · {rating.count}
                    {rating.count === 1 ? " besök" : " besök"}
                  </span>
                </>
              ) : (
                <span className="text-xs italic text-muted-foreground">
                  Inga besök än
                </span>
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
