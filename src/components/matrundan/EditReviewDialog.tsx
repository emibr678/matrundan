import * as React from "react";
import { ChevronDown, Pencil } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RatingInput } from "./Rating";
import { ReviewScoreFields } from "./ReviewScoreFields";
import { reviewRatingsComplete } from "@/lib/matrundan/review-model";
import { useStore } from "@/lib/matrundan/store";
import type { VisibleReview } from "@/lib/matrundan/types";

export function EditReviewDialog({
  review,
  placeName,
  compact = false,
}: {
  review: VisibleReview;
  placeName: string;
  compact?: boolean;
}) {
  const { updateOwnReview, submitting, state, demoReadOnly } = useStore();
  const scoreless = review.overall == null && review.reviewModel == null;
  const legacy = !scoreless && review.reviewModel == null;
  const [open, setOpen] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(
    review.taste != null || review.value != null || review.service != null,
  );
  const [overall, setOverall] = React.useState(review.overall ?? 0);
  const [taste, setTaste] = React.useState(review.taste ?? 0);
  const [value, setValue] = React.useState(review.value ?? 0);
  const [service, setService] = React.useState(review.service ?? 0);
  const [atmosphere, setAtmosphere] = React.useState(review.atmosphere ?? 0);
  const [comment, setComment] = React.useState(review.comment ?? "");
  const archived = state.group.lifecycleStatus === "archived";
  const complete = review.reviewModel
    ? reviewRatingsComplete(review.reviewModel, { taste, service, value, atmosphere })
    : true;

  React.useEffect(() => {
    if (!open) return;
    setOverall(review.overall ?? 0);
    setTaste(review.taste ?? 0);
    setValue(review.value ?? 0);
    setService(review.service ?? 0);
    setAtmosphere(review.atmosphere ?? 0);
    setComment(review.comment ?? "");
    setShowDetails(review.taste != null || review.value != null || review.service != null);
  }, [open, review]);

  async function save() {
    if (scoreless) {
      if (!comment.trim()) {
        toast.error("Kommentaren kan inte vara tom.");
        return;
      }
    } else if (legacy) {
      if (overall < 1 || overall > 5) {
        toast.error("Helhetsbetyget måste vara 1–5.");
        return;
      }
    } else if (!complete) {
      toast.error("Sätt alla relevanta betyg.");
      return;
    }
    try {
      await updateOwnReview(review.id, {
        overall: scoreless || review.reviewModel ? null : overall,
        taste: scoreless ? null : taste || null,
        value: scoreless ? null : value || null,
        service: scoreless ? null : service || null,
        atmosphere: scoreless || legacy ? null : atmosphere || null,
        comment: comment.trim() || null,
      });
      toast.success(scoreless ? "Din kommentar är uppdaterad." : "Ditt omdöme är uppdaterat.");
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
          {compact ? "Redigera" : scoreless ? "Redigera kommentar" : "Redigera omdöme"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scoreless ? "Redigera din kommentar" : "Redigera ditt omdöme"}</DialogTitle>
          <DialogDescription>
            {scoreless
              ? `${placeName}. Dryckesbesöket påverkar inte ställets betyg.`
              : legacy
                ? `${placeName}. Det här är ett äldre omdöme och behåller sitt manuella helhetsbetyg.`
                : `${placeName}. Helhetsbetyget räknas om från samma delar som när omdömet skapades.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!scoreless && review.reviewModel ? (
            <ReviewScoreFields
              model={review.reviewModel}
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

          {legacy ? (
            <>
              <div className="rounded-2xl bg-secondary/60 p-4">
                <RatingInput value={overall} onChange={setOverall} label="Helhetsbetyg" size={32} />
              </div>

              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium"
                  >
                    <span>Äldre detaljbetyg (frivilligt)</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <RatingInput value={taste} onChange={setTaste} label="Smak" />
                  <RatingInput value={service} onChange={setService} label="Service" />
                  <RatingInput value={value} onChange={setValue} label="Prisvärdhet" />
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={`edit-review-comment-${review.id}`}>
              {scoreless ? "Kommentar" : "Kommentar (frivilligt)"}
            </Label>
            <Textarea
              id={`edit-review-comment-${review.id}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="En liten minnesnotering…"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            disabled={submitting || (scoreless ? !comment.trim() : !complete)}
            onClick={() => void save()}
          >
            {submitting ? "Sparar…" : scoreless ? "Spara kommentar" : "Spara omdöme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
