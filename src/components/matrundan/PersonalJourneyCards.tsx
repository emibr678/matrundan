import { CalendarDays, Heart, MapPin, UserRoundCheck } from "lucide-react";
import { RatingStars } from "./Rating";
import { Card } from "@/components/ui/card";
import type {
  PersonalJourneyGroup,
  PersonalJourneyPlace,
  PersonalJourneyVisit,
} from "@/lib/matrundan/personal-journey";
import { formatPersonalJourneyGroups } from "@/lib/matrundan/personal-journey-presentation";
import { formatOwnVisitDate } from "@/lib/matrundan/sharing-selection";
import { visitMealLabel } from "@/lib/matrundan/visit-context";
import { formatRating } from "@/lib/matrundan/version";

function GroupContext({ groups }: { groups: PersonalJourneyGroup[] }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">
      <span className="truncate">{formatPersonalJourneyGroups(groups)}</span>
    </span>
  );
}

export function PersonalJourneyPlaceCard({
  place,
  onOpen,
}: {
  place: PersonalJourneyPlace;
  onOpen?: () => void;
}) {
  const content = (
    <Card className="h-full rounded-2xl border-border/70 p-4 transition-colors hover:bg-accent/35">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-display text-lg font-semibold [overflow-wrap:anywhere]">
              {place.name}
            </h3>
            {place.isFavorite ? (
              <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" aria-label="Favorit" />
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[place.area, place.city].filter(Boolean).join(", ")}
          </p>
          <div className="mt-2 flex min-h-5 items-center gap-2">
            {place.rating != null ? (
              <>
                <RatingStars value={place.rating} size={13} />
                <span className="text-xs font-medium">{formatRating(place.rating)}</span>
                <span className="text-xs text-muted-foreground">
                  {place.reviewCount} {place.reviewCount === 1 ? "omdöme" : "omdömen"}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Inget synligt betyg ännu</span>
            )}
          </div>
          <div className="mt-3">
            <GroupContext groups={place.groups} />
          </div>
        </div>
      </div>
    </Card>
  );

  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Visa ${place.name}`}
    >
      {content}
    </button>
  ) : (
    content
  );
}

export function PersonalJourneyVisitCard({
  visit,
  onOpen,
}: {
  visit: PersonalJourneyVisit;
  onOpen?: () => void;
}) {
  const context = `${visitMealLabel(visit.mealType)}${visit.isTakeaway ? " · Hämtmat" : ""}`;
  const content = (
    <Card className="rounded-2xl border-border/70 p-4 transition-colors hover:bg-accent/35">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-semibold">{visit.placeName}</h3>
              <p className="text-sm text-muted-foreground">
                {formatOwnVisitDate(visit.visitedOn)} · {context}
              </p>
            </div>
            {visit.participated ? (
              <UserRoundCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Du var med" />
            ) : null}
          </div>
          <div className="mt-2 flex min-h-5 items-center gap-2">
            {visit.rating != null ? (
              <>
                <RatingStars value={visit.rating} size={13} />
                <span className="text-xs font-medium">{formatRating(visit.rating)}</span>
                <span className="text-xs text-muted-foreground">
                  {visit.reviewCount} {visit.reviewCount === 1 ? "omdöme" : "omdömen"}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Inget synligt betyg ännu</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <GroupContext groups={visit.groups} />
            {visit.reviewPending ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Ditt omdöme saknas
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );

  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Visa besöket på ${visit.placeName}`}
    >
      {content}
    </button>
  ) : (
    content
  );
}
