import * as React from "react";
import { Loader2, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveOwnReviewForVisit } from "@/lib/matrundan/live-visit-participation";
import { reviewModelForContext, reviewRatingsComplete } from "@/lib/matrundan/review-model";
import { useSession } from "@/lib/matrundan/session";
import type { Occasion } from "@/lib/matrundan/types";
import { OccasionPicker } from "./OccasionPicker";
import { ReviewScoreFields } from "./ReviewScoreFields";

export function AddVisitReviewDialog({
  visitId,
  placeName,
  scoreless = false,
  isTakeaway = false,
  placeOccasions = [],
  disabled = false,
  onSaved,
}: {
  visitId: string;
  placeName: string;
  scoreless?: boolean;
  isTakeaway?: boolean;
  placeOccasions?: Occasion[];
  disabled?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const { activeGroupId } = useSession();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [atmosphere, setAtmosphere] = React.useState(0);
  const [reviewOccasions, setReviewOccasions] = React.useState<Occasion[]>([]);
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (open) return;
    setTaste(0);
    setValue(0);
    setService(0);
    setAtmosphere(0);
    setReviewOccasions([]);
    setComment("");
  }, [open]);

  const placeNeedsOccasionClassification = !scoreless && placeOccasions.length === 0;
  const classificationComplete = !placeNeedsOccasionClassification || reviewOccasions.length > 0;
  const model = scoreless
    ? null
    : reviewModelForContext({
        isTakeaway,
        occasions: placeNeedsOccasionClassification ? reviewOccasions : placeOccasions,
      });
  const complete = reviewRatingsComplete(model, { taste, service, value, atmosphere });

  async function save() {
    if (!activeGroupId) {
      toast.error("Ingen aktiv grupp.");
      return;
    }
    if (scoreless) {
      if (!comment.trim()) {
        toast.error("Skriv en kommentar först.");
        return;
      }
    } else if (!classificationComplete) {
      toast.error("Välj vad stället passar för först.");
      return;
    } else if (!model || !complete) {
      toast.error(model ? "Sätt alla relevanta betyg." : "Välj vad stället passar för först.");
      return;
    }

    setSaving(true);
    try {
      await saveOwnReviewForVisit(activeGroupId, visitId, {
        taste: scoreless ? null : taste,
        value: scoreless ? null : value,
        service: scoreless ? null : service,
        atmosphere: scoreless ? null : atmosphere || null,
        comment: comment.trim() || null,
        reviewOccasions:
          placeNeedsOccasionClassification && reviewOccasions.length > 0
            ? reviewOccasions
            : undefined,
      });
      toast.success(scoreless ? "Din kommentar är tillagd." : "Ditt omdöme är tillagt.");
      setOpen(false);
      await onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          {scoreless ? <MessageCircle className="h-4 w-4" /> : <Star className="h-4 w-4" />}
          {scoreless ? "Lägg till en kommentar" : "Lägg till ditt omdöme"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scoreless ? "Din kommentar" : "Ditt omdöme"}</DialogTitle>
          <DialogDescription>
            {scoreless
              ? `${placeName}. Dryckesbesöket räknas som ett besök men påverkar inte ställets betyg.`
              : `${placeName}. Helhetsbetyget räknas automatiskt från de relevanta delarna.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!scoreless && placeNeedsOccasionClassification ? (
            <div className="rounded-2xl bg-secondary/40 p-4">
              <OccasionPicker
                id={`visit-review-occasions-${visitId}`}
                value={reviewOccasions}
                onChange={setReviewOccasions}
                disabled={saving}
                required
                description="Stället saknar Passar för. Välj en eller två kategorier innan du sparar omdömet."
              />
            </div>
          ) : null}

          {!scoreless && model ? (
            <ReviewScoreFields
              model={model}
              taste={taste}
              service={service}
              value={value}
              atmosphere={atmosphere}
              onTasteChange={setTaste}
              onServiceChange={setService}
              onValueChange={setValue}
              onAtmosphereChange={setAtmosphere}
            />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={`visit-review-comment-${visitId}`}>
              {scoreless ? "Kommentar" : "Kommentar (frivilligt)"}
            </Label>
            <Textarea
              id={`visit-review-comment-${visitId}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="En liten minnesnotering…"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            disabled={
              saving || (scoreless ? !comment.trim() : !classificationComplete || !complete)
            }
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {scoreless ? "Spara kommentar" : "Spara omdöme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
