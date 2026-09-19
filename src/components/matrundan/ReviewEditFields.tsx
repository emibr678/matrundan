import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewModel, VisibleReview } from "@/lib/matrundan/types";
import { RatingInput } from "./Rating";
import { ReviewScoreFields } from "./ReviewScoreFields";

export function ReviewEditFields({
  review,
  scoreless,
  activeModel,
  showModelNotice = true,
  overall,
  taste,
  value,
  service,
  atmosphere,
  comment,
  onOverallChange,
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
  overall: number;
  taste: number;
  value: number;
  service: number;
  atmosphere: number;
  comment: string;
  onOverallChange: (value: number) => void;
  onTasteChange: (value: number) => void;
  onValueChange: (value: number) => void;
  onServiceChange: (value: number) => void;
  onAtmosphereChange: (value: number) => void;
  onCommentChange: (value: string) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const model = activeModel === undefined ? review.reviewModel : activeModel;
  const legacy = !scoreless && review.reviewModel == null;
  const [showLegacyDetails, setShowLegacyDetails] = React.useState(false);

  React.useEffect(() => {
    setShowLegacyDetails(false);
  }, [review.id, scoreless]);

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

      {legacy ? (
        <>
          <div className="rounded-2xl bg-secondary/60 p-4">
            <RatingInput
              value={overall}
              onChange={onOverallChange}
              label="Helhetsbetyg"
              size={32}
            />
          </div>

          <Collapsible open={showLegacyDetails} onOpenChange={setShowLegacyDetails}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium"
                disabled={disabled}
              >
                <span>Äldre detaljbetyg (frivilligt)</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showLegacyDetails ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <RatingInput value={taste} onChange={onTasteChange} label="Smak" />
              <RatingInput value={service} onChange={onServiceChange} label="Service" />
              <RatingInput value={value} onChange={onValueChange} label="Prisvärdhet" />
            </CollapsibleContent>
          </Collapsible>
        </>
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
