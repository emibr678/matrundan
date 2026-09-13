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
import { useStore } from "@/lib/matrundan/store";
import {
  OCCASION_DESCRIPTION,
  OCCASION_LABEL,
  OCCASION_VALUES,
  type Occasion,
  type Place,
} from "@/lib/matrundan/types";

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
  const [showGuide, setShowGuide] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelected([]);
    setShowGuide(false);
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
      toast.error(error instanceof Error ? error.message : "Kunde inte spara Passar för.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || submitting;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl">Vad passar stället för?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {place.name} saknar Passar för. Välj en eller två kategorier innan du registrerar
            besöket. Valet sparas på stället för gruppen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Passar för">
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
                  onClick={() => setSelected(toggleOccasionSelection(selected, occasion))}
                  className={`min-h-16 min-w-0 rounded-xl border px-2 py-2 text-center text-xs font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background hover:bg-secondary/60"
                  }`}
                >
                  <span className="block [overflow-wrap:anywhere]">{OCCASION_LABEL[occasion]}</span>
                </button>
              );
            })}
          </div>

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
            <div className="space-y-3 rounded-2xl bg-secondary/40 p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Kategorierna beskriver vilken sorts besök stället passar för, inte hur bra stället
                är.
              </p>
              {OCCASION_VALUES.map((occasion) => (
                <div key={occasion}>
                  <div className="text-sm font-medium">{OCCASION_LABEL[occasion]}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {OCCASION_DESCRIPTION[occasion]}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

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
      </DialogContent>
    </Dialog>
  );
}
