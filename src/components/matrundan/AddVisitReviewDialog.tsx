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
import {
  reviewModelForContext,
  reviewRatingsComplete,
} from "@/lib/matrundan/review-model";
import { useSession } from "@/lib/matrundan/session";
import { USER_GUIDANCE } from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";
import { useStore } from "@/lib/matrundan/store";
import type { Occasion } from "@/lib/matrundan/types";
import { getOwnVisitPhoto } from "@/lib/matrundan/visit-photo";
import {
  FirstReviewExplanation,
  FirstReviewGuidance,
} from "./FirstReviewGuidance";
import { OccasionPicker } from "./OccasionPicker";
import { ReviewScoreFields } from "./ReviewScoreFields";
import { VisitPhotoField } from "./VisitPhotoField";

export function AddVisitReviewDialog({
  visitId,
  placeName,
  scoreless = false,
  isTakeaway = false,
  placeOccasions = [],
  disabled = false,
  onSaved,
  onExit,
}: {
  visitId: string;
  placeName: string;
  scoreless?: boolean;
  isTakeaway?: boolean;
  placeOccasions?: Occasion[];
  disabled?: boolean;
  onSaved?: () => void | Promise<void>;
  onExit?: () => void;
}) {
  const { activeGroupId, mode, user } = useSession();
  const { state, saveVisitPhoto } = useStore();
  const { status, isAcknowledged, isPreviewing, acknowledge } =
    useUserGuidance();
  const visit = state.visits.find((item) => item.id === visitId);
  const ownPhoto = visit
    ? getOwnVisitPhoto(visit, state.currentUserId)
    : undefined;
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [atmosphere, setAtmosphere] = React.useState(0);
  const [reviewOccasions, setReviewOccasions] = React.useState<Occasion[]>([]);
  const [comment, setComment] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [guidanceAccepted, setGuidanceAccepted] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    setTaste(0);
    setValue(0);
    setService(0);
    setAtmosphere(0);
    setReviewOccasions([]);
    setComment("");
    setPhotoFile(null);
    setGuidanceAccepted(false);
  }, [open]);

  const placeNeedsOccasionClassification =
    !scoreless && placeOccasions.length === 0;
  const classificationComplete =
    !placeNeedsOccasionClassification || reviewOccasions.length > 0;
  const activeOccasions = placeNeedsOccasionClassification
    ? reviewOccasions
    : placeOccasions;
  const model = scoreless
    ? null
    : reviewModelForContext({
        isTakeaway,
        occasions: activeOccasions,
      });
  const complete = reviewRatingsComplete(model, {
    taste,
    service,
    value,
    atmosphere,
  });

  const reviewContextAcknowledged = isAcknowledged(
    USER_GUIDANCE.reviewContext,
  );
  const showFirstReviewGuide =
    !scoreless &&
    mode === "live" &&
    Boolean(user?.id) &&
    (isPreviewing(USER_GUIDANCE.reviewContext) ||
      (status === "ready" && !reviewContextAcknowledged));
  const ratingsUnlocked = !showFirstReviewGuide || guidanceAccepted;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && open && !saving) onExit?.();
  }

  function acceptGuidance() {
    void acknowledge(USER_GUIDANCE.reviewContext);
    setGuidanceAccepted(true);
  }

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
      toast.error("Välj typ av upplevelse först.");
      return;
    } else if (!model || !complete) {
      toast.error(
        model
          ? "Sätt alla relevanta betyg."
          : "Välj typ av upplevelse först.",
      );
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

      if (photoFile && visit) {
        try {
          await saveVisitPhoto(visitId, photoFile, visit);
        } catch (photoError) {
          toast.warning(
            scoreless
              ? "Kommentaren sparades, men bilden kunde inte sparas."
              : "Omdömet sparades, men bilden kunde inte sparas.",
          );
          setOpen(false);
          await onSaved?.();
          onExit?.();
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
      await onSaved?.();
      onExit?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte spara.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          {scoreless ? (
            <MessageCircle className="h-4 w-4" />
          ) : (
            <Star className="h-4 w-4" />
          )}
          {scoreless ? "Lägg till en kommentar" : "Lägg till ditt omdöme"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {scoreless ? "Din kommentar" : "Ditt omdöme"}
          </DialogTitle>
          <DialogDescription>
            {scoreless
              ? `${placeName}. Dryckesbesöket räknas som ett besök men påverkar inte ställets betyg.`
              : placeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!scoreless &&
          showFirstReviewGuide &&
          !guidanceAccepted &&
          placeNeedsOccasionClassification ? (
            <FirstReviewExplanation />
          ) : null}

          {!scoreless &&
          placeNeedsOccasionClassification &&
          (!showFirstReviewGuide || !guidanceAccepted) ? (
            <div className="rounded-2xl bg-secondary/40 p-4">
              <OccasionPicker
                id={`visit-review-occasions-${visitId}`}
                value={reviewOccasions}
                onChange={setReviewOccasions}
                disabled={saving}
                required
                showGuide={!showFirstReviewGuide}
                description="Välj en eller två typer av upplevelse innan du fortsätter till betyget."
              />
            </div>
          ) : null}

          {!scoreless &&
          showFirstReviewGuide &&
          !guidanceAccepted &&
          classificationComplete ? (
            <FirstReviewGuidance
              occasions={activeOccasions}
              showExplanation={!placeNeedsOccasionClassification}
              showCurrentType={!placeNeedsOccasionClassification}
              disabled={saving}
              onContinue={acceptGuidance}
            />
          ) : null}

          {!scoreless && model && ratingsUnlocked ? (
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

          {scoreless || ratingsUnlocked ? (
            <>
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

              {visit ? (
                <VisitPhotoField
                  file={photoFile}
                  onFileChange={setPhotoFile}
                  existingUrl={ownPhoto?.url}
                  disabled={saving}
                  showHelpText={false}
                  compact
                />
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setOpen(false);
              onExit?.();
            }}
          >
            Avbryt
          </Button>
          {scoreless || ratingsUnlocked ? (
            <Button
              disabled={
                saving ||
                (scoreless
                  ? !comment.trim()
                  : !classificationComplete || !complete)
              }
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {scoreless ? "Spara kommentar" : "Spara omdöme"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
