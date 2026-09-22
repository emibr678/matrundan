import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRating } from "@/lib/matrundan/version";
import type { ReviewModel, VisibleReview } from "@/lib/matrundan/types";
import { RatingStars } from "./Rating";
import { ReviewScoreFields } from "./ReviewScoreFields";

export function ReviewEditFields({
  review,
  scoreless,
  activeModel,
  showModelNotice = true,
  taste,
  value,
  service,
  atmosphere,
  comment,
  onTasteChange,
  onValueChange,
  onServiceChange,
  onAtmosphereChange,
  onCommentChange,
  idPrefix,
  disabled = false,
  modelUpgrade,
}: {
  review: VisibleReview;
  scoreless: boolean;
  activeModel?: ReviewModel | null;
  showModelNotice?: boolean;
  taste: number;
  value: number;
  service: number;
  atmosphere: number;
  comment: string;
  onTasteChange: (value: number) => void;
  onValueChange: (value: number) => void;
  onServiceChange: (value: number) => void;
  onAtmosphereChange: (value: number) => void;
  onCommentChange: (value: string) => void;
  idPrefix: string;
  disabled?: boolean;
  modelUpgrade?: {
    active: boolean;
    onStart: () => void;
    onCancel: () => void;
  };
}) {
  const model = activeModel === undefined ? review.reviewModel : activeModel;

  return (
    <div className="space-y-4">
      {!scoreless && model === "food_v0_overall" ? (
        <div className="space-y-2 rounded-2xl border border-border/70 p-4">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Helhetsbetyg</div>
              <div className="mt-1 text-xl font-bold">
                {review.overall == null ? "— / 5" : `${formatRating(review.overall)} / 5`}
              </div>
            </div>
            <RatingStars value={review.overall ?? 0} size={20} showEmpty />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Det här är ett äldre omdöme där bara helhetsbetyget sparades. Vi behåller det som det
            är.
          </p>
        </div>
      ) : !scoreless && model ? (
        <ReviewScoreFields
          model={model}
          taste={taste}
          service={service}
          value={value}
          atmosphere={atmosphere}
          onTasteChange={onTasteChange}
          onServiceChange={onServiceChange}
          onValueChange={onValueChange}
          onAtmosphereChange={onAtmosphereChange}
          showModelNotice={showModelNotice}
          modelUpgrade={modelUpgrade}
          disabled={disabled}
        />
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-comment`}>
          {scoreless ? "Kommentar" : "Kommentar (frivilligt)"}
        </Label>
        <Textarea
          id={`${idPrefix}-comment`}
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          rows={3}
          placeholder="En liten minnesnotering…"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
