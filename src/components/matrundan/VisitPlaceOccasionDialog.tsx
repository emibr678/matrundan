import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeOccasionClassification } from "@/lib/matrundan/occasions";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { USER_GUIDANCE } from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";
import { type Occasion, type Place } from "@/lib/matrundan/types";
import { FirstReviewGuidance } from "./FirstReviewGuidance";
import { OccasionClassificationChoices } from "./OccasionPicker";

export function VisitPlaceOccasionDialog({
  open,
  place,
  onCancel,
}: {
  open: boolean;
  place: Place;
  onCancel: () => void;
}) {
  const { mode, user } = useSession();
  const { updatePlaceMetadata, submitting } = useStore();
  const { status, isAcknowledged, isPreviewing, acknowledge } =
    useUserGuidance();
  const [selected, setSelected] = React.useState<Occasion[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [guidanceAccepted, setGuidanceAccepted] = React.useState(false);

  const reviewContextAcknowledged = isAcknowledged(
    USER_GUIDANCE.reviewContext,
  );
  const showFirstGuidance =
    mode === "live" &&
    Boolean(user?.id) &&
    (isPreviewing(USER_GUIDANCE.reviewContext) ||
      (status === "ready" && !reviewContextAcknowledged));
  const firstGuidanceActive = showFirstGuidance && !guidanceAccepted;

  React.useEffect(() => {
    if (!open) return;
    setSelected([]);
    setGuidanceAccepted(false);
  }, [open, place.id]);

  function acceptGuidance() {
    void acknowledge(USER_GUIDANCE.reviewContext);
    setGuidanceAccepted(true);
  }

  async function saveAndContinue() {
    const occasions = normalizeOccasionClassification(selected);
    if (occasions.length === 0) {
      toast.error("Välj minst ett alternativ.");
      return;
    }

    setSaving(true);
    try {
      await updatePlaceMetadata(place.id, {
        categoryOverride: place.categoryOverride ?? null,
        cuisinesOverride: place.cuisinesOverride ?? null,
        occasions,
        notes: place.notes ?? null,
      });
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

  const busy = saving || submitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}
    >
      <DialogContent
        key={firstGuidanceActive ? "guidance" : "classification"}
        className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">
            {firstGuidanceActive
              ? "Innan du sätter betyg"
              : "Hur skulle ni beskriva matupplevelsen?"}
          </DialogTitle>
          {firstGuidanceActive ? (
            <DialogDescription className="sr-only">
              Kort introduktion till Typ av upplevelse och omdömen.
            </DialogDescription>
          ) : (
            <DialogDescription className="leading-relaxed">
              Välj den typ av upplevelse som bäst beskriver stället – eller två
              om båda passar. Valet sparas för gruppen.
            </DialogDescription>
          )}
        </DialogHeader>

        {firstGuidanceActive ? (
          <FirstReviewGuidance
            disabled={busy}
            onContinue={acceptGuidance}
          />
        ) : (
          <>
            <OccasionClassificationChoices
              value={selected}
              onChange={setSelected}
              disabled={busy}
            />

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onCancel}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                disabled={busy || selected.length === 0}
                onClick={() => void saveAndContinue()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Spara och fortsätt
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
