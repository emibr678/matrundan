import { formatRating } from "@/lib/matrundan/version";
import {
  deriveReviewOverall,
  reviewModelExplanation,
  reviewModelIncludesAtmosphere,
  type ReviewModel,
} from "@/lib/matrundan/review-model";
import { RatingInput, RatingStars } from "./Rating";

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
}) {
  const overall = deriveReviewOverall(model, { taste, service, value, atmosphere });
  const explanation = reviewModelExplanation(model);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 rounded-2xl border border-border/70 p-4">
        <RatingInput value={taste} onChange={onTasteChange} label="Smak" />
        <RatingInput value={service} onChange={onServiceChange} label="Service" />
        <RatingInput value={value} onChange={onValueChange} label="Prisvärdhet" />
        {reviewModelIncludesAtmosphere(model) ? (
          <RatingInput value={atmosphere} onChange={onAtmosphereChange} label="Atmosfär" />
        ) : null}
      </div>

      {explanation ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{explanation}</p>
      ) : null}

      <div
        className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3"
        aria-live="polite"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">Helhetsbetyg</div>
          <div className="text-xs text-muted-foreground">Räknas automatiskt</div>
          <div className={overall == null ? "mt-1 text-sm font-semibold" : "mt-1 text-xl font-bold"}>
            {overall == null ? "Sätt alla betyg" : `${formatRating(overall)} / 5`}
          </div>
        </div>
        {overall != null ? <RatingStars value={overall} size={20} /> : null}
      </div>
    </div>
  );
}
