import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reviewModelExplanation, type ReviewModel } from "@/lib/matrundan/review-model";
import { OCCASION_LABEL } from "@/lib/matrundan/types";

export function ReviewModelNotice({ model }: { model: ReviewModel }) {
  const explanation = reviewModelExplanation(model);
  if (!explanation) return null;

  const takeaway = model === "food_v1_takeaway";
  const quickLabel = OCCASION_LABEL.snabbt;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
      <span>
        {takeaway ? (
          explanation
        ) : (
          <>
            Atmosfär ingår inte för <strong className="font-semibold">{quickLabel}</strong>.
          </>
        )}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-8 rounded-full px-2 py-1 text-xs text-muted-foreground"
            aria-label={
              takeaway
                ? "Varför ingår inte Atmosfär vid Hämtmat?"
                : `Varför ingår inte Atmosfär för ${quickLabel}?`
            }
          >
            <CircleHelp className="h-3.5 w-3.5" />
            Varför?
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Varför räknas inte Atmosfär?</div>
            {takeaway ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Vid Hämtmat äts maten inte på plats. Därför är atmosfären inte en del av just den
                besöksupplevelsen och räknas inte in i helhetsbetyget.
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  För <strong className="font-semibold">{quickLabel}</strong> väger vi inte in
                  Atmosfär. På sådana ställen är miljön oftast mindre avgörande för
                  helhetsupplevelsen, och en enklare atmosfär är mer förväntad.
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Om stället också passar för{" "}
                  <strong className="font-semibold">{OCCASION_LABEL.avslappnat}</strong> eller{" "}
                  <strong className="font-semibold">{OCCASION_LABEL.middag}</strong> räknas Atmosfär
                  med.
                </p>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
