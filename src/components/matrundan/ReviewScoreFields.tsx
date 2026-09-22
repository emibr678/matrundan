import { formatRating } from "@/lib/matrundan/version";
import {
  deriveReviewOverall,
  reviewModelIncludesAtmosphere,
  type ReviewModel,
} from "@/lib/matrundan/review-model";
import { Button } from "@/components/ui/button";
import { RatingInput, RatingStars } from "./Rating";
import { ReviewModelNotice } from "./ReviewModelNotice";

export function ReviewScoreFields({
  model,
  taste,
  service,
  value,
  atmosphere,
  onTasteChange,
  onServiceChange,
  onValueChange,
  onAtmosphereChange,
  showModelNotice = true,
  modelUpgrade,
  disabled = false,
}: {
  model: ReviewModel;
  taste: number;
  service: number;
  value: number;
  atmosphere: number;
  onTasteChange: (value: number) => void;
  onServiceChange: (value: number) => void;
  onValueChange: (value: number) => void;
  onAtmosphereChange: (value: number) => void;
  showModelNotice?: boolean;
  modelUpgrade?: {
    active: boolean;
    onStart: () => void;
    onCancel: () => void;
  };
  disabled?: boolean;
}) {
  const overall = deriveReviewOverall(model, { taste, service, value, atmosphere });

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Detaljbetyg"
        className="grid gap-3 rounded-2xl border border-border/70 p-4"
      >
        <RatingInput value={taste} onChange={onTasteChange} label="Smak" />
        <RatingInput value={service} onChange={onServiceChange} label="Service" />
        <RatingInput value={value} onChange={onValueChange} label="Prisvärdhet" />
        {reviewModelIncludesAtmosphere(model) ? (
          <>
            <RatingInput value={atmosphere} onChange={onAtmosphereChange} label="Atmosfär" />
            {modelUpgrade?.active ? (
              <div className="rounded-xl bg-secondary/50 px-3 py-2.5 text-sm">
                <p className="text-muted-foreground">
                  När du sparar läggs Atmosfär till i omdömet och helhetsbetyget räknas om.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1 min-h-10 w-auto px-0 text-xs text-muted-foreground"
                  disabled={disabled}
                  onClick={modelUpgrade.onCancel}
                >
                  Ångra
                </Button>
              </div>
            ) : null}
          </>
        ) : modelUpgrade ? (
          <div className="border-t border-border/60 pt-3">
            <div className="text-sm font-semibold">Atmosfär</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ingick inte i betyget när omdömet skapades.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-1 min-h-10 w-auto justify-start px-0 text-sm text-primary"
              disabled={disabled}
              onClick={modelUpgrade.onStart}
            >
              Lägg till Atmosfär
            </Button>
          </div>
        ) : null}
      </div>

      {showModelNotice ? <ReviewModelNotice model={model} /> : null}

      <div
        className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3"
        aria-live="polite"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">Helhetsbetyg</div>
          <div className="text-xs text-muted-foreground">Räknas automatiskt</div>
          <div className="mt-1 text-xl font-bold">
            {overall == null ? "— / 5" : `${formatRating(overall)} / 5`}
          </div>
        </div>
        <RatingStars value={overall ?? 0} size={20} showEmpty />
      </div>
    </div>
  );
}
