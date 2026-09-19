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
import { persistDemoState } from "@/lib/matrundan/demo-state";
import { saveOwnDemoReviewForVisit } from "@/lib/matrundan/demo-visit-participation";
import { reviewModelForContext, reviewRatingsComplete } from "@/lib/matrundan/review-model";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Occasion } from "@/lib/matrundan/types";
import { getOwnVisitPhoto } from "@/lib/matrundan/visit-photo";
import { OccasionPicker } from "./OccasionPicker";
import { ReviewScoreFields } from "./ReviewScoreFields";
import { VisitPhotoField } from "./VisitPhotoField";

export function DemoAddVisitReviewDialog({
  visitId,
  placeName,
  scoreless = false,
  isTakeaway = false,
  placeOccasions = [],
  disabled = false,
}: {
  visitId: string;
  placeName: string;
  scoreless?: boolean;
  isTakeaway?: boolean;
  placeOccasions?: Occasion[];
  disabled?: boolean;
}) {
  const { state, saveVisitPhoto } = useStore();
  const { exampleMode } = useSession();
  const visit = state.visits.find((item) => item.id === visitId);
  const ownPhoto = visit ? getOwnVisitPhoto(visit, state.currentUserId) : undefined;
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [atmosphere, setAtmosphere] = React.useState(0);
  const [reviewOccasions, setReviewOccasions] = React.useState<Occasion[]>([]);
  const [comment, setComment] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (open) return;
    setTaste(0);
    setValue(0);
    setService(0);
    setAtmosphere(0);
    setReviewOccasions([]);
    setComment("");
    setPhotoFile(null);
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
      const nextState = saveOwnDemoReviewForVisit(state, visitId, {
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
      persistDemoState(nextState, exampleMode);

      if (photoFile && visit) {
        try {
          await saveVisitPhoto(visitId, photoFile, visit);
        } catch {
          toast.warning(
            scoreless
              ? "Kommentaren sparades, men bilden kunde inte sparas."
              : "Omdömet sparades, men bilden kunde inte sparas.",
          );
          setOpen(false);
          return;
        }
      }

      toast.success(
        photoFile
          ? scoreless
            ? "Din kommentar och bild är tillagda."
            : "Ditt omdöme och din bild är tillagda."
          : scoreless
            ? "Din kommentar är tillagd."
            : "Ditt omdöme är tillagt.",
      );
      setOpen(false);
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
                id={`demo-visit-review-occasions-${visitId}`}
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
            <Label htmlFor={`demo-visit-review-comment-${visitId}`}>
              {scoreless ? "Kommentar" : "Kommentar (frivilligt)"}
            </Label>
            <Textarea
              id={`demo-visit-review-comment-${visitId}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="En liten minnesnotering…"
            />
          </div>

          {visit ? (
            <VisitPhotoField
              file={photoFile}
              onFileChange={setPhotoFile}
              existingUrl={ownPhoto?.url}
              disabled={saving}
              compact
            />
          ) : null}
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
