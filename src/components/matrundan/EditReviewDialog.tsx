import * as React from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setReviewGroupVisibility } from "@/lib/matrundan/live-sharing";
import {
  canUpgradeReviewModelWithAtmosphere,
  effectiveReviewModel,
  reviewModelForContext,
  reviewModelIncludesAtmosphere,
  reviewRatingsComplete,
} from "@/lib/matrundan/review-model";
import { useSession } from "@/lib/matrundan/session";
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
  onChanged,
}: {
  review: VisibleReview;
  placeName: string;
  compact?: boolean;
  scoreless?: boolean;
  isTakeaway?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const {
    updateOwnReview,
    upgradeOwnReviewModel,
    saveVisitPhoto,
    deleteVisitPhoto,
    submitting,
    state,
    demoReadOnly,
  } = useStore();
  const { mode, activeGroupId } = useSession();
  const visit = state.visits.find((item) =>
    (item.visibleReviews ?? []).some((candidate) => candidate.id === review.id),
  );
  const ownPhoto = visit ? getOwnVisitPhoto(visit, state.currentUserId) : undefined;
  const scoreless = scorelessOverride ?? (review.overall == null && review.reviewModel == null);
  const historicalOverallOnly = review.reviewModel === "food_v0_overall";
  const activeModel = effectiveReviewModel(review.reviewModel, isTakeaway);
  const storedModelHasAtmosphere = reviewModelIncludesAtmosphere(review.reviewModel);
  const place = visit ? state.places.find((item) => item.id === visit.placeId) : undefined;
  const currentContextModel = place
    ? reviewModelForContext({ isTakeaway, occasions: place.occasions })
    : null;
  const canCompleteAtmosphere = canUpgradeReviewModelWithAtmosphere(
    review.reviewModel,
    currentContextModel,
  );
  const [open, setOpen] = React.useState(false);
  const [completingAtmosphere, setCompletingAtmosphere] = React.useState(false);
  const [confirmUpgradeOpen, setConfirmUpgradeOpen] = React.useState(false);
  const displayModel = completingAtmosphere ? "food_v1_atmosphere" : activeModel;
  const activeModelHasAtmosphere = reviewModelIncludesAtmosphere(displayModel);
  const [taste, setTaste] = React.useState(review.taste ?? 0);
  const [value, setValue] = React.useState(review.value ?? 0);
  const [service, setService] = React.useState(review.service ?? 0);
  const [atmosphere, setAtmosphere] = React.useState(review.atmosphere ?? 0);
  const [comment, setComment] = React.useState(review.comment ?? "");
  const [commentVisible, setCommentVisible] = React.useState(review.commentVisible);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = React.useState(false);
  const archived = state.group.lifecycleStatus === "archived";
  const complete = historicalOverallOnly
    ? review.overall != null
    : displayModel
      ? reviewRatingsComplete(displayModel, { taste, service, value, atmosphere })
      : scoreless;

  React.useEffect(() => {
    if (!open) return;
    setCompletingAtmosphere(false);
    setConfirmUpgradeOpen(false);
    setTaste(review.taste ?? 0);
    setValue(review.value ?? 0);
    setService(review.service ?? 0);
    setAtmosphere(review.atmosphere ?? 0);
    setComment(review.comment ?? "");
    setCommentVisible(review.commentVisible);
    setPhotoFile(null);
    setRemovePhoto(false);
  }, [open, review]);

  async function save(upgradeConfirmed = false) {
    if (scoreless) {
      if (!comment.trim()) {
        toast.error("Kommentaren kan inte vara tom.");
        return;
      }
    } else if (!displayModel) {
      toast.error("Omdömets betygsmodell saknas.");
      return;
    } else if (!complete) {
      toast.error("Sätt alla relevanta betyg.");
      return;
    }

    if (completingAtmosphere && !upgradeConfirmed) {
      setConfirmUpgradeOpen(true);
      return;
    }

    try {
      const reviewInput = {
        overall: null,
        taste: scoreless || historicalOverallOnly ? null : taste || null,
        value: scoreless || historicalOverallOnly ? null : value || null,
        service: scoreless || historicalOverallOnly ? null : service || null,
        atmosphere:
          scoreless || historicalOverallOnly || (!completingAtmosphere && !storedModelHasAtmosphere)
            ? null
            : activeModelHasAtmosphere
              ? atmosphere || null
              : (review.atmosphere ?? null),
        comment: comment.trim() || null,
      };

      if (completingAtmosphere) {
        await upgradeOwnReviewModel(review.id, {
          taste,
          value,
          service,
          atmosphere,
          comment: reviewInput.comment,
        });
      } else {
        await updateOwnReview(review.id, reviewInput);
      }

      let visibilityWarning: string | null = null;
      if (
        mode === "live" &&
        activeGroupId &&
        comment.trim() &&
        commentVisible !== review.commentVisible
      ) {
        try {
          await setReviewGroupVisibility(
            review.id,
            activeGroupId,
            review.ratingVisible,
            commentVisible,
          );
        } catch {
          visibilityWarning =
            "Omdömet sparades, men kommentarens synlighet i gruppen kunde inte uppdateras.";
        }
      }

      if (visit && photoFile) {
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
      } else if (visit && removePhoto && ownPhoto) {
        try {
          await deleteVisitPhoto(visit.id, ownPhoto.uploadedBy);
        } catch {
          toast.warning(
            scoreless
              ? "Kommentaren sparades, men bilden kunde inte tas bort."
              : "Omdömet sparades, men bilden kunde inte tas bort.",
          );
          setOpen(false);
          return;
        }
      }

      let successMessage = scoreless
        ? "Din kommentar är uppdaterad."
        : "Ditt omdöme är uppdaterat.";

      if (photoFile) {
        successMessage = scoreless
          ? "Din kommentar och bild är uppdaterade."
          : "Ditt omdöme och din bild är uppdaterade.";
      } else if (removePhoto) {
        successMessage = scoreless
          ? "Din kommentar är uppdaterad och bilden borttagen."
          : "Ditt omdöme är uppdaterat och bilden borttagen.";
      }

      if (onChanged) await onChanged();
      if (visibilityWarning) {
        toast.warning(visibilityWarning);
      } else {
        toast.success(successMessage);
      }
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
          {scoreless ? "Redigera kommentar" : "Redigera omdöme"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scoreless ? "Redigera din kommentar" : "Redigera ditt omdöme"}</DialogTitle>
          <DialogDescription>
            {scoreless
              ? `${placeName}. Dryckesbesöket påverkar inte ställets betyg.`
              : historicalOverallOnly
                ? placeName
                : review.reviewModel === "food_v0_3d"
                  ? `${placeName}. Helhetsbetyget räknas automatiskt från Smak, Service och Prisvärdhet.`
                  : `${placeName}. Helhetsbetyget räknas automatiskt från de delar som gäller för besöket.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ReviewEditFields
            review={review}
            scoreless={scoreless}
            activeModel={displayModel}
            showModelNotice={!(displayModel === "food_v1_takeaway" && !isTakeaway)}
            taste={taste}
            value={value}
            service={service}
            atmosphere={atmosphere}
            comment={comment}
            onTasteChange={setTaste}
            onValueChange={setValue}
            onServiceChange={setService}
            onAtmosphereChange={setAtmosphere}
            onCommentChange={setComment}
            idPrefix={`edit-review-${review.id}`}
            disabled={submitting}
            modelUpgrade={
              canCompleteAtmosphere
                ? {
                    active: completingAtmosphere,
                    onStart: () => setCompletingAtmosphere(true),
                    onCancel: () => {
                      setCompletingAtmosphere(false);
                      setAtmosphere(review.atmosphere ?? 0);
                    },
                  }
                : undefined
            }
          />

          {mode === "live" &&
          activeGroupId &&
          visit?.linkType === "shared" &&
          comment.trim() ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
              <span className="text-sm font-medium">Visa kommentaren i den här gruppen</span>
              <Switch
                aria-label="Visa kommentaren i den här gruppen"
                checked={commentVisible}
                onCheckedChange={setCommentVisible}
                disabled={submitting}
              />
            </div>
          ) : null}

          {visit ? (
            <VisitPhotoField
              file={photoFile}
              onFileChange={(file) => {
                setPhotoFile(file);
                if (file) setRemovePhoto(false);
              }}
              existingUrl={ownPhoto?.url}
              disabled={submitting}
              showHelpText={false}
              allowRemoveExisting={!!ownPhoto}
              removeExisting={removePhoto}
              onRemoveExistingChange={(remove) => {
                setRemovePhoto(remove);
                if (remove) setPhotoFile(null);
              }}
              compact
            />
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            disabled={submitting || (scoreless ? !comment.trim() : !displayModel || !complete)}
            onClick={() => void save()}
          >
            {submitting ? "Sparar…" : scoreless ? "Spara kommentar" : "Spara omdöme"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={confirmUpgradeOpen}
        onOpenChange={(nextOpen) => {
          if (!submitting) setConfirmUpgradeOpen(nextOpen);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Lägga till Atmosfär?</AlertDialogTitle>
            <AlertDialogDescription>
              När du sparar blir Atmosfär en permanent del av omdömet och helhetsbetyget räknas om.
              Du kan ändra betyget senare, men inte ta bort Atmosfär igen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={submitting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={() => void save(true)}>
              {submitting ? "Sparar…" : "Lägg till och spara"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
