import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatMealType, formatOwnVisitDate } from "@/lib/matrundan/sharing-selection";
import type { StrongVisitDuplicateCandidate } from "@/lib/matrundan/visit-duplicates";

export function VisitDuplicatePrompt({
  candidate,
  mode,
  busy,
  onDismiss,
  onUseExisting,
  onDifferentVisit,
}: {
  candidate: StrongVisitDuplicateCandidate | null;
  mode: "register" | "share";
  busy: boolean;
  onDismiss: () => void;
  onUseExisting: () => void;
  onDifferentVisit: () => void;
}) {
  if (!candidate) return null;

  const visitSummary = `${formatOwnVisitDate(candidate.visitedOn)} · ${formatMealType(candidate.mealType)}`;

  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onDismiss()}>
      <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === "register"
              ? "Det här besöket verkar redan finnas"
              : "Gruppen verkar redan ha det här besöket"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              Du har redan ett besök {visitSummary} där du är deltagare.
            </span>
            <span className="block">
              {mode === "register"
                ? "Öppna det befintliga besöket och komplettera där om det är samma händelse. Det du fyllt i här kopieras inte automatiskt."
                : "Behåll det befintliga besöket om det är samma händelse, eller fortsätt bara om det faktiskt var ett separat besök."}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onDismiss} disabled={busy}>
            Avbryt
          </Button>
          <Button type="button" variant="outline" onClick={onDifferentVisit} disabled={busy}>
            Det var ett annat besök
          </Button>
          <Button type="button" onClick={onUseExisting} disabled={busy}>
            {mode === "register" ? "Öppna och komplettera besöket" : "Behåll befintligt besök"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
