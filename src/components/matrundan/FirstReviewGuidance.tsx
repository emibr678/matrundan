import { Button } from "@/components/ui/button";
import { OccasionGuideContent } from "./OccasionPicker";

export function FirstReviewExplanation() {
  return (
    <div className="rounded-2xl bg-secondary/40 p-4">
      <div className="font-medium">
        Kul att du ska lämna ditt första omdöme!
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Innan du sätter betyg vill vi kort visa hur Matrundan skiljer på olika
        typer av matupplevelser.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Ett enkelt gatukök och en finkrog är olika slags upplevelser och behöver
        inte jämföras som om de vore samma sak. Båda kan få lika höga betyg –
        fast av olika skäl.
      </p>
      <div className="mt-4 text-sm font-medium">Tre typer av matupplevelser</div>
      <div className="mt-2">
        <OccasionGuideContent showHeading={false} showIntro={false} />
      </div>
    </div>
  );
}

export function FirstReviewGuidance({
  onContinue,
  disabled = false,
}: {
  onContinue: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <FirstReviewExplanation />
      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={disabled}
        onClick={onContinue}
      >
        Jag förstår
      </Button>
    </div>
  );
}
