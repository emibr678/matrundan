import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reviewModelExplanation, type ReviewModel } from "@/lib/matrundan/review-model";

export function ReviewModelNotice({ model }: { model: ReviewModel }) {
  const explanation = reviewModelExplanation(model);
  if (!explanation) return null;

  if (model !== "food_v1_quick") {
    return <p className="text-xs leading-relaxed text-muted-foreground">{explanation}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
      <span>{explanation}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-8 rounded-full px-2 py-1 text-xs text-muted-foreground"
            aria-label="Varför ingår inte Atmosfär för Snabbt och enkelt?"
          >
            <CircleHelp className="h-3.5 w-3.5" />
            Varför?
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Varför räknas inte Atmosfär?</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              För Snabbt och enkelt väger vi inte in Atmosfär. På sådana ställen är miljön oftast
              mindre avgörande för helhetsupplevelsen, och en enklare atmosfär är mer förväntad.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Om stället också passar för Avslappnat eller Något extra räknas Atmosfär med.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
