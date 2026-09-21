import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewModel, VisibleReview } from "@/lib/matrundan/types";
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
}) {
  const model = activeModel === undefined ? review.reviewModel : activeModel;

  return (
    <div className="space-y-4">
      {!scoreless && model ? (
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
