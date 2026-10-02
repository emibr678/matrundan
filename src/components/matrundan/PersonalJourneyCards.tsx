import { Heart, MapPin, UserRoundCheck } from "lucide-react";
import { PlaceIdentityMark } from "@/components/matrundan/PlaceIdentityMark";
import { Card } from "@/components/ui/card";
import { PlaceSummary, VisitSummary } from "./SummaryCardContent";
import type {
  PersonalJourneyGroup,
  PersonalJourneyPlace,
  PersonalJourneyVisit,
} from "@/lib/matrundan/personal-journey";
import { formatPersonalJourneyGroups } from "@/lib/matrundan/personal-journey-presentation";
import { resolvePlaceSymbol } from "@/lib/matrundan/place-symbol";
import { formatOwnVisitDate } from "@/lib/matrundan/sharing-selection";
import type { PlaceCategory } from "@/lib/matrundan/types";
import { visitMealLabel } from "@/lib/matrundan/visit-context";

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
    <Card className="h-full rounded-2xl border-border/70 p-3 transition-colors hover:bg-accent/35">
      <PlaceSummary
        name={place.name}
        meta={[place.area, place.city].filter(Boolean).join(", ")}
        rating={place.rating}
        reviewCount={place.reviewCount}
        leading={
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </div>
        }
        trailing={
          place.isFavorite ? (
            <Heart className="h-4 w-4 fill-primary text-primary" aria-label="Favorit" />
          ) : null
        }
        footer={<GroupContext groups={place.groups} />}
      />
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
  const category = (visit.category ?? "restaurang") as PlaceCategory;
  const content = (
    <Card className="rounded-2xl border-border/70 p-2.5 transition-colors hover:bg-accent/35">
      <VisitSummary
        placeName={visit.placeName}
        meta={`${formatOwnVisitDate(visit.visitedOn)} · ${context}`}
        rating={visit.rating}
        reviewCount={visit.reviewCount}
        leading={
          <PlaceIdentityMark
            category={category}
            symbol={resolvePlaceSymbol({ category })}
            size="sm"
          />
        }
        trailing={
          visit.participated ? (
            <UserRoundCheck className="h-4 w-4 text-primary" aria-label="Du var med" />
          ) : null
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <GroupContext groups={visit.groups} />
            {visit.reviewPending ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Omdöme att lämna
              </span>
            ) : null}
          </div>
        }
      />
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
