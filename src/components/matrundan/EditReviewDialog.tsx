import * as React from "react";
import { Pencil } from "lucide-react";
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
import {
  effectiveReviewModel,
  reviewModelIncludesAtmosphere,
  reviewRatingsComplete,
} from "@/lib/matrundan/review-model";
import { useStore } from "@/lib/matrundan/store";
import type { VisibleReview } from "@/lib/matrundan/types";
import { getOwnVisitPhoto } from "@/lib/matrundan/visit-photo";
import { ReviewEditFields } from "./ReviewEditFields";
import { VisitPhotoField } from "./VisitPhotoField";

export function EditReviewDialog({
  review,
  placeName,
  compact = false,
  scoreless: scorelessOverride,
  isTakeaway = false,
}: {
  review: VisibleReview;
  placeName: string;
  compact?: boolean;
  scoreless?: boolean;
  isTakeaway?: boolean;
}) {
  const { updateOwnReview, saveVisitPhoto, submitting, state, demoReadOnly } = useStore();
  const visit = state.visits.find((item) =>
    (item.visibleReviews ?? []).some((candidate) => candidate.id === review.id),
  );
  const ownPhoto = visit ? getOwnVisitPhoto(visit, state.currentUserId) : undefined;
  const scoreless = scorelessOverride ?? (review.overall == null && review.reviewModel == null);
  const legacy = !scoreless && review.reviewModel == null;
  const activeModel = effectiveReviewModel(review.reviewModel, isTakeaway);
  const storedModelHasAtmosphere = reviewModelIncludesAtmosphere(review.reviewModel);
  const activeModelHasAtmosphere = reviewModelIncludesAtmosphere(activeModel);
  const [open, setOpen] = React.useState(false);
  const [overall, setOverall] = React.useState(review.overall ?? 0);
  const [taste, setTaste] = React.useState(review.taste ?? 0);
  const [value, setValue] = React.useState(review.value ?? 0);
  const [service, setService] = React.useState(review.service ?? 0);
  const [atmosphere, setAtmosphere] = React.useState(review.atmosphere ?? 0);
  const [comment, setComment] = React.useState(review.comment ?? "");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const archived = state.group.lifecycleStatus === "archived";
  const complete = activeModel
    ? reviewRatingsComplete(activeModel, { taste, service, value, atmosphere })
    : true;

  React.useEffect(() => {
    if (!open) return;
    setOverall(review.overall ?? 0);
    setTaste(review.taste ?? 0);
    setValue(review.value ?? 0);
    setService(review.service ?? 0);
    setAtmosphere(review.atmosphere ?? 0);
    setComment(review.comment ?? "");
    setPhotoFile(null);
  }, [open, review]);

  async function save() {
    if (scoreless) {
      if (!comment.trim()) {
        toast.error("Kommentaren kan inte vara tom.");
        return;
      }
    } else if (legacy) {
      if (overall < 1 || overall > 5) {
        toast.error("Helhetsbetyget måste vara 1–5.");
        return;
      }
    } else if (!complete) {
      toast.error("Sätt alla relevanta betyg.");
      return;
    }
    try {
      await updateOwnReview(review.id, {
        overall: scoreless || review.reviewModel ? null : overall,
        taste: scoreless ? null : taste || null,
        value: scoreless ? null : value || null,
        service: scoreless ? null : service || null,
        atmosphere:
          scoreless || legacy
            ? null
            : storedModelHasAtmosphere
              ? activeModelHasAtmosphere
                ? atmosphere || null
                : (review.atmosphere ?? null)
              : null,
        comment: comment.trim() || null,
      });

      if (photoFile && visit) {
        try {
          await saveVisitPhoto(visit.id, photoFile, visit);
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
            ? "Din kommentar och bild är uppdaterade."
            : "Ditt omdöme och din bild är uppdaterade."
          : scoreless
            ? "Din kommentar är uppdaterad."
            : "Ditt omdöme är uppdaterat.",
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera.");
    }
  }

  if (archived || demoReadOnly) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={compact ? "ghost" : "secondary"}
          aria-label={compact ? (scoreless ? "Redigera kommentar" : "Redigera omdöme") : undefined}
          className={
            compact
              ? "min-h-10 w-auto gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              : "w-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
          }
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {compact ? "Redigera" : scoreless ? "Redigera kommentar" : "Redigera omdöme"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scoreless ? "Redigera din kommentar" : "Redigera ditt omdöme"}</DialogTitle>
          <DialogDescription>
            {scoreless
              ? `${placeName}. Dryckesbesöket påverkar inte ställets betyg.`
              : legacy
                ? `${placeName}. Det här är ett äldre omdöme och behåller sitt manuella helhetsbetyg.`
                : `${placeName}. Helhetsbetyget räknas automatiskt från de delar som gäller för besöket.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ReviewEditFields
            review={review}
            scoreless={scoreless}
            activeModel={activeModel}
            showModelNotice={!(activeModel === "food_v1_takeaway" && !isTakeaway)}
            overall={overall}
            taste={taste}
            value={value}
            service={service}
            atmosphere={atmosphere}
            comment={comment}
            onOverallChange={setOverall}
            onTasteChange={setTaste}
            onValueChange={setValue}
            onServiceChange={setService}
            onAtmosphereChange={setAtmosphere}
            onCommentChange={setComment}
            idPrefix={`edit-review-${review.id}`}
            disabled={submitting}
          />

          {visit ? (
            <VisitPhotoField
              file={photoFile}
              onFileChange={setPhotoFile}
              existingUrl={ownPhoto?.url}
              disabled={submitting}
              showHelpText={false}
              compact
            />
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            disabled={submitting || (scoreless ? !comment.trim() : !complete)}
            onClick={() => void save()}
          >
            {submitting ? "Sparar…" : scoreless ? "Spara kommentar" : "Spara omdöme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
