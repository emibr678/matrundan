import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  reviewModelIncludesAtmosphere,
  type ReviewModel,
} from "@/lib/matrundan/review-model";
import { OCCASION_LABEL, type Occasion } from "@/lib/matrundan/types";
import { ReviewContextGuideContent } from "./ReviewContextGuide";

function reviewPartsDescription(
  model: ReviewModel,
  isTakeaway: boolean,
): string {
  if (isTakeaway) {
    return "Eftersom besöket är Hämtmat ingår Smak, Service och Prisvärdhet. Atmosfär ingår inte.";
  }
  if (!reviewModelIncludesAtmosphere(model)) {
    return "I det här omdömet ingår Smak, Service och Prisvärdhet. Atmosfär ingår inte.";
  }
  return "I det här omdömet ingår Smak, Service, Prisvärdhet och Atmosfär.";
}

export function FirstReviewGuidance({
  placeName,
  occasions,
  model,
  isTakeaway,
  showReviewContext,
  onContinue,
  disabled = false,
}: {
  placeName: string;
  occasions: Occasion[];
  model: ReviewModel;
  isTakeaway: boolean;
  showReviewContext: boolean;
  onContinue: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 p-4">
        <div className="text-xs font-medium text-muted-foreground">
          {placeName} är markerat som
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {occasions.map((occasion) => (
            <Badge key={occasion} variant="secondary" className="rounded-full">
              {OCCASION_LABEL[occasion]}
            </Badge>
          ))}
        </div>
      </div>

      {showReviewContext ? (
        <div className="rounded-2xl bg-secondary/40 p-4">
          <div className="font-medium">Så fungerar omdömen</div>
          <div className="mt-2">
            <ReviewContextGuideContent />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {reviewPartsDescription(model, isTakeaway)}
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={disabled}
        onClick={onContinue}
      >
        {showReviewContext ? "Jag förstår – sätt betyg" : "Fortsätt till betyg"}
      </Button>
    </div>
  );
}
