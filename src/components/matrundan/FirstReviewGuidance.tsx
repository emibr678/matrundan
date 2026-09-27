import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OCCASION_LABEL, type Occasion } from "@/lib/matrundan/types";
import { OccasionGuideContent } from "./OccasionPicker";

export function FirstReviewExplanation() {
  return (
    <div className="rounded-2xl bg-secondary/40 p-4">
      <div className="font-medium">Kul att du vill lämna ett omdöme!</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Innan du sätter betyg vill vi kort visa hur Matrundan skiljer på olika
        typer av matupplevelser.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Ett snabbt gatukök och en finkrog är olika slags upplevelser och behöver
        inte jämföras som om de vore samma sak. Båda kan få lika höga betyg –
        fast av olika skäl.
      </p>
      <div className="mt-3">
        <OccasionGuideContent showHeading={false} showIntro={false} />
      </div>
    </div>
  );
}

export function FirstReviewGuidance({
  occasions,
  showExplanation = true,
  showCurrentType = true,
  onContinue,
  disabled = false,
}: {
  occasions: Occasion[];
  showExplanation?: boolean;
  showCurrentType?: boolean;
  onContinue: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showExplanation ? <FirstReviewExplanation /> : null}

      {showCurrentType ? (
        <div className="rounded-2xl border border-border/70 p-4">
          <div className="text-xs font-medium text-muted-foreground">
            Typ av upplevelse
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {occasions.map((occasion) => (
              <Badge
                key={occasion}
                variant="secondary"
                className="rounded-full"
              >
                {OCCASION_LABEL[occasion]}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={disabled}
        onClick={onContinue}
      >
        Jag förstår – sätt betyg
      </Button>
    </div>
  );
}
