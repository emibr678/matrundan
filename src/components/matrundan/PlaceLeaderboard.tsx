import type * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { OccasionGuide } from "@/components/matrundan/OccasionPicker";
import { RatingStars } from "@/components/matrundan/Rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  RANKABLE_VISIT_MEALS,
  type RankableVisitMeal,
} from "@/lib/matrundan/visit-context-ranking";
import { OCCASION_LABEL, OCCASION_VALUES, type Occasion } from "@/lib/matrundan/types";
import { VISIT_MEAL_LABEL } from "@/lib/matrundan/visit-context";
import { formatRating } from "@/lib/matrundan/version";

export interface PlaceLeaderboardItem {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  rank?: number;
  visitCount?: number;
  leading?: React.ReactNode;
  context?: React.ReactNode;
}

export function PlaceLeaderboardRows({
  items,
  onOpen,
  layout = "grid",
}: {
  items: PlaceLeaderboardItem[];
  onOpen: (item: PlaceLeaderboardItem) => void;
  layout?: "grid" | "list";
}) {
  return (
    <div className={layout === "list" ? "grid min-w-0 gap-2" : "grid min-w-0 gap-2 md:grid-cols-3"}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item)}
          className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Öppna ${item.name}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {item.rank ?? index + 1}
          </span>
          {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.name}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-2">
              <RatingStars value={item.rating} size={12} />
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {formatRating(item.rating)}
                {item.visitCount != null ? ` · ${item.visitCount} besök` : ""}
                {" · "}
                {item.reviewCount} {item.reviewCount === 1 ? "omdöme" : "omdömen"}
              </span>
            </span>
            {item.context ? (
              <span className="mt-1.5 block min-w-0 truncate text-xs text-muted-foreground">
                {item.context}
              </span>
            ) : null}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function PlaceLeaderboardFilters({
  occasions,
  onToggleOccasion,
  meals,
  onToggleMeal,
  takeawayOnly,
  onToggleTakeaway,
}: {
  occasions: Occasion[];
  onToggleOccasion: (occasion: Occasion) => void;
  meals: RankableVisitMeal[];
  onToggleMeal: (meal: RankableVisitMeal) => void;
  takeawayOnly: boolean;
  onToggleTakeaway: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <div className="mb-0.5 flex min-h-8 items-center gap-1 text-sm font-medium text-foreground">
          <span>Typ av upplevelse</span>
          <span className="-my-1.5 inline-flex">
            <OccasionGuide compact />
          </span>
        </div>
        <div
          className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2"
          role="group"
          aria-label="Filtrera topplistan på Typ av upplevelse. Inget val visar alla."
        >
          {OCCASION_VALUES.map((occasion) => {
            const active = occasions.includes(occasion);
            return (
              <button
                key={occasion}
                type="button"
                onClick={() => onToggleOccasion(occasion)}
                aria-pressed={active}
                aria-label={`Filtrera topplistan på ${OCCASION_LABEL[occasion]}`}
                className="min-h-11 min-w-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className="w-full cursor-pointer justify-center rounded-full px-1.5 py-1 text-[11px] sm:w-auto sm:px-3 sm:text-xs"
                >
                  {OCCASION_LABEL[occasion]}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-0.5 text-sm font-medium text-foreground">Tillfälle</div>
        <div
          className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap sm:gap-2"
          role="group"
          aria-label="Filtrera topplistan på besökstillfälle. Inget val visar alla tillfällen."
        >
          {RANKABLE_VISIT_MEALS.map((meal) => {
            const active = meals.includes(meal);
            return (
              <button
                key={meal}
                type="button"
                onClick={() => onToggleMeal(meal)}
                aria-pressed={active}
                aria-label={`Filtrera topplistan på ${VISIT_MEAL_LABEL[meal]}`}
                className="min-h-11 min-w-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className="w-full cursor-pointer justify-center rounded-full px-1 py-1 text-[11px] sm:w-auto sm:px-3 sm:text-xs"
                >
                  {VISIT_MEAL_LABEL[meal]}
                </Badge>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onToggleTakeaway}
            aria-pressed={takeawayOnly}
            aria-label="Filtrera topplistan på hämtmat"
            className="min-h-11 min-w-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge
              variant={takeawayOnly ? "default" : "outline"}
              className="w-full cursor-pointer justify-center rounded-full px-1 py-1 text-[11px] sm:w-auto sm:px-3 sm:text-xs"
            >
              Hämtmat
            </Badge>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceLeaderboard({
  leader,
  items,
  open,
  onOpenChange,
  occasions,
  onToggleOccasion,
  meals,
  onToggleMeal,
  takeawayOnly,
  onToggleTakeaway,
  onOpenItem,
  emptyMessage = "Inga betyg matchar de valda filtren ännu.",
}: {
  leader: PlaceLeaderboardItem | null;
  items: PlaceLeaderboardItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occasions: Occasion[];
  onToggleOccasion: (occasion: Occasion) => void;
  meals: RankableVisitMeal[];
  onToggleMeal: (meal: RankableVisitMeal) => void;
  takeawayOnly: boolean;
  onToggleTakeaway: () => void;
  onOpenItem: (item: PlaceLeaderboardItem) => void;
  emptyMessage?: string;
}) {
  if (!leader) return null;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section
        aria-labelledby="place-leaderboard-heading"
        data-testid="occasion-leaderboard"
        className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          {open ? (
            <h2 id="place-leaderboard-heading" className="min-w-0 flex-1 font-display text-lg">
              Topplista
            </h2>
          ) : (
            <button
              type="button"
              onClick={() => onOpenItem(leader)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Ledare i topplistan: ${leader.name}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                1
              </span>
              <span className="min-w-0 flex-1">
                <span
                  id="place-leaderboard-heading"
                  className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Topplista
                </span>
                <span className="block truncate text-sm font-medium">{leader.name}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2">
                  <RatingStars value={leader.rating} size={12} />
                  <span className="truncate text-xs text-muted-foreground">
                    {formatRating(leader.rating)} · {leader.reviewCount}{" "}
                    {leader.reviewCount === 1 ? "omdöme" : "omdömen"}
                  </span>
                </span>
              </span>
            </button>
          )}

          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto min-h-11 shrink-0 rounded-full px-3 text-xs text-muted-foreground"
              aria-label={open ? "Dölj topplista" : "Visa topp 3"}
            >
              {open ? "Dölj" : "Visa topp 3"}
              <ChevronDown
                className={["h-4 w-4 transition-transform", open ? "rotate-180" : ""].join(" ")}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-1.5">
          <PlaceLeaderboardFilters
            occasions={occasions}
            onToggleOccasion={onToggleOccasion}
            meals={meals}
            onToggleMeal={onToggleMeal}
            takeawayOnly={takeawayOnly}
            onToggleTakeaway={onToggleTakeaway}
          />

          <div className="mt-3">
            {items.length > 0 ? (
              <PlaceLeaderboardRows items={items} onOpen={onOpenItem} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-4 py-5 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
