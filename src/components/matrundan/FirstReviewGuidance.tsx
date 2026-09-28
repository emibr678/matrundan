import { Button } from "@/components/ui/button";
import { OccasionGuideContent } from "./OccasionPicker";

export function FirstReviewExplanation() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 px-1">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Kul att du ska lämna ditt första omdöme! I Matrundan skiljer vi på olika typer av
          matupplevelser.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ett enkelt gatukök och en finkrog är olika slags matupplevelser. Båda kan få lika höga
          betyg – fast av olika skäl.
        </p>
      </div>

      <div className="rounded-2xl bg-secondary/40 p-4">
        <div className="text-sm font-medium">Tre typer av matupplevelser</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Ett matställe kan beskrivas med en eller två av dem.
        </p>
        <div className="mt-3">
          <OccasionGuideContent showHeading={false} showIntro={false} showConclusion={false} />
        </div>
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
      <Button type="button" className="min-h-11 w-full" disabled={disabled} onClick={onContinue}>
        Jag förstår
      </Button>
    </div>
  );
}
