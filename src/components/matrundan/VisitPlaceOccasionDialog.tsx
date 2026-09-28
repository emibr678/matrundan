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
import { useStore } from "@/lib/matrundan/store";
import { type Occasion, type Place } from "@/lib/matrundan/types";
import { FirstReviewGuidance } from "./FirstReviewGuidance";
import { OccasionClassificationChoices } from "./OccasionPicker";
import { useReviewContextGate } from "./useReviewContextGate";

export function VisitPlaceOccasionDialog({
  open,
  place,
  onCancel,
}: {
  open: boolean;
  place: Place;
  onCancel: () => void;
}) {
  const { updatePlaceMetadata, submitting } = useStore();
  const [selected, setSelected] = React.useState<Occasion[]>([]);
  const [saving, setSaving] = React.useState(false);

  const reviewGuidance = useReviewContextGate({
    open,
    eligible: true,
  });
  const firstGuidanceActive = reviewGuidance.state === "guide";
  const firstGuidanceLoading = reviewGuidance.state === "loading";

  React.useEffect(() => {
    if (!open) return;
    setSelected([]);
  }, [open, place.id]);

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
      toast.error(error instanceof Error ? error.message : "Kunde inte spara typ av upplevelse.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || submitting;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}>
      <DialogContent
        key={
          firstGuidanceLoading
            ? "guidance-loading"
            : firstGuidanceActive
              ? "guidance"
              : "classification"
        }
        className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">
            {firstGuidanceLoading
              ? "Hur skulle ni beskriva matupplevelsen?"
              : firstGuidanceActive
                ? "Innan du sätter betyg"
                : "Hur skulle ni beskriva matupplevelsen?"}
          </DialogTitle>
          {firstGuidanceLoading ? (
            <DialogDescription>Förbereder nästa steg…</DialogDescription>
          ) : firstGuidanceActive ? (
            <DialogDescription className="sr-only">
              Kort introduktion till Typ av upplevelse och omdömen.
            </DialogDescription>
          ) : (
            <DialogDescription className="leading-relaxed">
              Välj den typ av upplevelse som bäst beskriver stället – eller två om båda passar.
              Valet sparas för gruppen.
            </DialogDescription>
          )}
        </DialogHeader>

        {firstGuidanceLoading ? (
          <div
            role="status"
            className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Förbereder nästa steg…
          </div>
        ) : firstGuidanceActive ? (
          <FirstReviewGuidance disabled={busy} onContinue={reviewGuidance.accept} />
        ) : (
          <>
            <OccasionClassificationChoices
              value={selected}
              onChange={setSelected}
              disabled={busy}
            />

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
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
