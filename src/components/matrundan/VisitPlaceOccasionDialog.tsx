import * as React from "react";
import { CircleHelp, Loader2 } from "lucide-react";
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
import {
  normalizeOccasionClassification,
  toggleOccasionSelection,
} from "@/lib/matrundan/occasions";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { USER_GUIDANCE } from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";
import {
  OCCASION_LABEL,
  OCCASION_VALUES,
  type Occasion,
  type Place,
} from "@/lib/matrundan/types";
import { OccasionGuideContent } from "./OccasionPicker";

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
  const [showGuide, setShowGuide] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const occasionModelAcknowledged = isAcknowledged(
    USER_GUIDANCE.occasionModel,
  );
  const showOccasionModelGuide =
    mode === "live" &&
    Boolean(user?.id) &&
    (isPreviewing(USER_GUIDANCE.occasionModel) ||
      (status === "ready" && !occasionModelAcknowledged));

  React.useEffect(() => {
    if (!open) return;
    setSelected([]);
    setShowGuide(false);
  }, [open, place.id]);

  function handleSelection(occasion: Occasion) {
    setSelected(toggleOccasionSelection(selected, occasion));
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
      if (showOccasionModelGuide) {
        void acknowledge(USER_GUIDANCE.occasionModel);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kunde inte spara Passar för.",
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
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">
            När passar stället bäst?
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {showOccasionModelGuide
              ? "Passar för beskriver vilken typ av matupplevelse ni skulle välja stället för. Läs igenom alternativen och välj en eller två."
              : "Välj en eller två kategorier som bäst beskriver när ni skulle välja stället. Det hjälper gruppen att hitta rätt matställe för olika tillfällen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {showOccasionModelGuide ? (
            <div className="rounded-2xl bg-secondary/40 p-3">
              <OccasionGuideContent />
            </div>
          ) : null}

          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-label="Passar för"
          >
            {OCCASION_VALUES.map((occasion) => {
              const active = selected.includes(occasion);
              const atLimit = selected.length >= 2;
              return (
                <button
                  key={occasion}
                  type="button"
                  aria-label={`Passar för: ${OCCASION_LABEL[occasion]}`}
                  aria-pressed={active}
                  disabled={busy || (atLimit && !active)}
                  onClick={() => handleSelection(occasion)}
                  className={`min-h-16 min-w-0 rounded-xl border px-2 py-2 text-center text-xs font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background hover:bg-secondary/60"
                  }`}
                >
                  <span className="block whitespace-nowrap">
                    {OCCASION_LABEL[occasion]}
                  </span>
                </button>
              );
            })}
          </div>

          {!showOccasionModelGuide ? (
            <>
              <button
                type="button"
                className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={showGuide}
                onClick={() => setShowGuide((current) => !current)}
              >
                <CircleHelp className="h-4 w-4" />
                Vad betyder alternativen?
              </button>

              {showGuide ? (
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <OccasionGuideContent />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

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
            {showOccasionModelGuide
              ? "Jag förstår – spara och fortsätt"
              : "Spara och fortsätt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
