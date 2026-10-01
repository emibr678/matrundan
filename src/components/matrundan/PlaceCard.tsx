import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolvePlaceSymbol } from "@/lib/matrundan/place-symbol";
import { CATEGORY_LABEL, type Place } from "@/lib/matrundan/types";
import { useStore } from "@/lib/matrundan/store";
import { PlaceIdentityMark, type PlaceIdentityMarkSize } from "./PlaceIdentityMark";
import { PlaceSummary } from "./SummaryCardContent";
import { StatusBadge } from "./StatusBadge";

export function formatCompactPlaceAddress(address: string, city: string): string {
  const normalizedCity = city.trim().toLocaleLowerCase("sv");
  const addressAlreadyContainsCity =
    normalizedCity.length > 0 &&
    address
      .split(",")
      .map((part) => part.trim().toLocaleLowerCase("sv"))
      .includes(normalizedCity);

  return [address.trim(), addressAlreadyContainsCity ? "" : city.trim()].filter(Boolean).join(", ");
}

export function PlaceThumb({ place, size = "md" }: { place: Place; size?: PlaceIdentityMarkSize }) {
  return (
    <PlaceIdentityMark category={place.category} symbol={resolvePlaceSymbol(place)} size={size} />
  );
}

export function PlaceCard({ place, readOnly = false }: { place: Place; readOnly?: boolean }) {
  const { avgRating, isFavorite, toggleFavorite } = useStore();
  const rating = avgRating(place.id);
  const fav = isFavorite(place.id);

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        to="/matstallen/$placeId"
        params={{ placeId: place.id }}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={place.name}
      />
      <PlaceSummary
        name={<span className="group-hover:underline">{place.name}</span>}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{CATEGORY_LABEL[place.category]}</span>
            {place.cuisines.slice(0, 2).map((c) => (
              <span key={c}>· {c}</span>
            ))}
          </span>
        }
        rating={rating.count > 0 ? rating.overall : null}
        reviewCount={rating.count}
        leading={<PlaceThumb place={place} />}
        trailing={
          !readOnly ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={(event) => {
                event.preventDefault();
                void toggleFavorite(place.id);
              }}
              className="relative z-20 h-11 w-11 shrink-0 rounded-full"
              aria-pressed={fav}
              aria-label={fav ? "Ta bort favorit" : "Markera som favorit"}
            >
              <Heart
                className={
                  fav ? "h-4 w-4 fill-primary stroke-primary" : "h-4 w-4 stroke-muted-foreground"
                }
              />
            </Button>
          ) : null
        }
        footer={
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatCompactPlaceAddress(place.address, place.city)}
              </span>
            </div>
            <div className="shrink-0">
              <StatusBadge placeId={place.id} />
            </div>
          </div>
        }
      />
    </Card>
  );
}
