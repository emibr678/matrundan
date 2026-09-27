import { Button } from "@/components/ui/button";
import { OccasionGuideContent } from "./OccasionPicker";

export function FirstReviewExplanation() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 px-1">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            Kul att du ska lämna ditt första omdöme!
          </span>{" "}
          I Matrundan skiljer vi på olika typer av matupplevelser.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ett enkelt gatukök och en finkrog är olika slags matupplevelser.{" "}
          <strong className="font-medium text-foreground">
            Båda kan få lika höga betyg – fast av olika skäl.
          </strong>
        </p>
      </div>

      <div className="rounded-2xl bg-secondary/40 p-4">
        <div className="text-sm font-medium">Tre typer av matupplevelser</div>
        <div className="mt-3">
          <OccasionGuideContent
            showHeading={false}
            showIntro={false}
            showConclusion={false}
          />
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Ett matställe kan passa in i en eller två typer av upplevelser. Det
        hjälper gruppen att hitta rätt sorts matställe för stunden och gör
        betygen lättare att förstå och jämföra.
      </p>
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
