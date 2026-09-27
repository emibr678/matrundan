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
  const occasionPreviewing = isPreviewing(USER_GUIDANCE.occasionGuide);

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
              <DialogTitle className="font-display text-2xl">
                Testverktyg
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-2 leading-relaxed">
            Spela upp produktguidning utan att radera eller ändra ditt sparade
            kvitto. Simuleringen gäller bara den här appsessionen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="font-medium">Kärnintroduktion</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Öppnar samma dialog och avslut som vid automatisk onboarding.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3 min-h-11"
              onClick={playCoreIntro}
            >
              <Play className="h-4 w-4" aria-hidden />
              Spela upp
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 p-4">
            <div className="font-medium">Passar för</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Visar förstagångshjälpen nästa gång du öppnar ett obligatoriskt
              Passar för-val. Ditt riktiga kvitto lämnas orört.
            </p>
            {occasionPreviewing ? (
              <div className="mt-2 text-xs font-medium text-amber-800">
                Simuleringen väntar på nästa relevanta val.
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 min-h-11"
              onClick={() =>
                occasionPreviewing
                  ? clearPreview(USER_GUIDANCE.occasionGuide)
                  : preview(USER_GUIDANCE.occasionGuide)
              }
            >
              {occasionPreviewing ? (
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
