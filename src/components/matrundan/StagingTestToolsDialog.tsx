import { FlaskConical, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IS_STAGING } from "@/lib/app-environment";
import { USER_GUIDANCE } from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";
import { previewProductIntro } from "./ProductIntroDialog";

export function StagingTestToolsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isPreviewing, preview, clearPreview } = useUserGuidance();
  const reviewContextPreviewing = isPreviewing(USER_GUIDANCE.reviewContext);
  const personalJourneyIntroPreviewing = isPreviewing(
    USER_GUIDANCE.personalJourneyIntro,
  );

  if (!IS_STAGING) return null;

  function playCoreIntro() {
    preview(USER_GUIDANCE.coreIntro);
    onOpenChange(false);
    window.setTimeout(previewProductIntro, 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
              <FlaskConical className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] text-amber-800">
                ENDAST STAGING
              </div>
              <DialogTitle className="font-display text-2xl">Testverktyg</DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-2 leading-relaxed">
            Spela upp produktguidning utan att radera eller ändra ditt sparade kvitto. Simuleringen
            gäller bara den här appsessionen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="font-medium">Kärnintroduktion</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Startar samma introduktion till Matrundan, Matställen, Hem och Gruppen som en ny
              användare får.
            </p>
            <Button type="button" size="sm" className="mt-3 min-h-11" onClick={playCoreIntro}>
              <Play className="h-4 w-4" aria-hidden />
              Spela upp
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 p-4">
            <div className="font-medium">Min matresa</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Simulerar att introduktionen är osedd. Kortet visas på Hem när kontot har minst två
              aktiva grupper och ingen viktigare uppmärksamhetsyta ligger före.
            </p>
            {personalJourneyIntroPreviewing ? (
              <div className="mt-2 text-xs font-medium text-amber-800">
                Simuleringen är aktiv tills du öppnar Min matresa, stänger kortet eller avbryter
                här.
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 min-h-11"
              onClick={() =>
                personalJourneyIntroPreviewing
                  ? clearPreview(USER_GUIDANCE.personalJourneyIntro)
                  : preview(USER_GUIDANCE.personalJourneyIntro)
              }
            >
              {personalJourneyIntroPreviewing ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Avbryt simulering
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden />
                  Simulera osedd
                </>
              )}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 p-4">
            <div className="font-medium">Typ av upplevelse och omdömen</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Visar samma sammanhängande första-gångenförklaring nästa gång Typ av upplevelse eller
              ett poängsatt omdöme blir relevant. Ditt riktiga kvitto lämnas orört.
            </p>
            {reviewContextPreviewing ? (
              <div className="mt-2 text-xs font-medium text-amber-800">
                Simuleringen väntar på nästa relevanta flöde.
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 min-h-11"
              onClick={() =>
                reviewContextPreviewing
                  ? clearPreview(USER_GUIDANCE.reviewContext)
                  : preview(USER_GUIDANCE.reviewContext)
              }
            >
              {reviewContextPreviewing ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Avbryt simulering
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden />
                  Simulera osedd
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
