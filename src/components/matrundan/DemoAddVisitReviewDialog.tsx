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
import {
  reviewModelForContext,
  reviewRatingsComplete,
} from "@/lib/matrundan/review-model";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Occasion, Place } from "@/lib/matrundan/types";
import {
  applyPreparedVisitPhotoToDemoState,
  blobToDataUrl,
  getOwnVisitPhoto,
  prepareVisitPhoto,
} from "@/lib/matrundan/visit-photo";
import { OccasionPicker } from "./OccasionPicker";
import { ReviewScoreFields } from "./ReviewScoreFields";
import { VisitPhotoField } from "./VisitPhotoField";

export function DemoAddVisitReviewDialog({
  visitId,
  place,
  placeName,
  scoreless = false,
  isTakeaway = false,
  placeOccasions = [],
  disabled = false,
  onExit,
}: {
  visitId: string;
  place?: Place;
  placeName: string;
  scoreless?: boolean;
  isTakeaway?: boolean;
  placeOccasions?: Occasion[];
  disabled?: boolean;
  onExit?: () => void;
}) {
  const { state, updatePlaceMetadata } = useStore();
  const { exampleMode } = useSession();
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
  const [classificationSaved, setClassificationSaved] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (open) return;
    setTaste(0);
    setValue(0);
    setService(0);
    setAtmosphere(0);
    setReviewOccasions([]);
    setClassificationSaved(false);
    setComment("");
    setPhotoFile(null);
  }, [open]);

  const needsInitialClassification =
    !scoreless && placeOccasions.length === 0;
  const classificationActive =
    needsInitialClassification && !classificationSaved;
  const activeOccasions = needsInitialClassification
    ? reviewOccasions
    : placeOccasions;
  const model =
    scoreless || classificationActive
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

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && open && !saving) onExit?.();
  }

  async function saveClassificationAndContinue() {
    if (reviewOccasions.length === 0) {
      toast.error("Välj minst ett alternativ.");
      return;
    }
    if (!place) {
      toast.error("Kunde inte hitta matstället.");
      return;
    }

    setSaving(true);
    try {
      await updatePlaceMetadata(place.id, {
        categoryOverride: place.categoryOverride ?? null,
        cuisinesOverride: place.cuisinesOverride ?? null,
        occasions: reviewOccasions,
        notes: place.notes ?? null,
      });
      setClassificationSaved(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kunde inte spara typ av upplevelse.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (scoreless) {
      if (!comment.trim()) {
        toast.error("Skriv en kommentar först.");
        return;
      }
    } else if (!model || !complete) {
      toast.error("Sätt alla relevanta betyg.");
      return;
    }

    setSaving(true);
    try {
      let nextState = saveOwnDemoReviewForVisit(state, visitId, {
        taste: scoreless ? null : taste,
        value: scoreless ? null : value,
        service: scoreless ? null : service,
        atmosphere: scoreless ? null : atmosphere || null,
        comment: comment.trim() || null,
        reviewOccasions:
          needsInitialClassification && reviewOccasions.length > 0
            ? reviewOccasions
            : undefined,
      });

      if (photoFile && visit) {
        try {
          const prepared = await prepareVisitPhoto(photoFile);
          const url = await blobToDataUrl(prepared.blob);
          nextState = applyPreparedVisitPhotoToDemoState(
            nextState,
            visitId,
            prepared,
            url,
          );
        } catch {
          persistDemoState(nextState, exampleMode);
          toast.warning(
            scoreless
              ? "Kommentaren sparades, men bilden kunde inte sparas."
              : "Omdömet sparades, men bilden kunde inte sparas.",
          );
          setOpen(false);
          onExit?.();
          return;
        }
      }

      persistDemoState(nextState, exampleMode);
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
      <DialogContent
        key={classificationActive ? "classification" : "review"}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>
            {classificationActive
              ? "Hur skulle ni beskriva matupplevelsen?"
              : scoreless
                ? "Din kommentar"
                : "Ditt omdöme"}
          </DialogTitle>
          <DialogDescription>
            {classificationActive
              ? "Välj en eller två typer av upplevelse som bäst beskriver stället och när ni skulle välja det. Valet sparas för gruppen."
              : scoreless
                ? `${placeName}. Dryckesbesöket räknas som ett besök men påverkar inte ställets betyg.`
                : placeName}
          </DialogDescription>
        </DialogHeader>

        {classificationActive ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary/40 p-4">
              <OccasionPicker
                id={`demo-visit-review-occasions-${visitId}`}
                value={reviewOccasions}
                onChange={setReviewOccasions}
                disabled={saving}
                required
              />
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
              <Button
                disabled={saving || reviewOccasions.length === 0}
                onClick={() => void saveClassificationAndContinue()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Spara och fortsätt
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
                  showHelpText={false}
                  compact
                />
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
              <Button
                disabled={
                  saving || (scoreless ? !comment.trim() : !model || !complete)
                }
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {scoreless ? "Spara kommentar" : "Spara omdöme"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
