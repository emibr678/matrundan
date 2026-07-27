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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RatingInput } from "./Rating";
import { useStore } from "@/lib/matrundan/store";
import type { VisibleReview } from "@/lib/matrundan/types";

export function EditReviewDialog({
  review,
  placeName,
}: {
  review: VisibleReview;
  placeName: string;
}) {
  const { updateOwnReview, submitting, state } = useStore();
  const [open, setOpen] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(
    review.taste != null || review.value != null || review.service != null,
  );
  const [overall, setOverall] = React.useState(review.overall);
  const [taste, setTaste] = React.useState(review.taste ?? 0);
  const [value, setValue] = React.useState(review.value ?? 0);
  const [service, setService] = React.useState(review.service ?? 0);
  const [comment, setComment] = React.useState(review.comment ?? "");
  const archived = state.group.lifecycleStatus === "archived";

  React.useEffect(() => {
    if (!open) return;
    setOverall(review.overall);
    setTaste(review.taste ?? 0);
    setValue(review.value ?? 0);
    setService(review.service ?? 0);
    setComment(review.comment ?? "");
    setShowDetails(
      review.taste != null || review.value != null || review.service != null,
    );
  }, [open, review]);

  async function save() {
    if (overall < 1 || overall > 5) {
      toast.error("Helhetsbetyget måste vara 1–5.");
      return;
    }
    try {
      await updateOwnReview(review.id, {
        overall,
        taste: taste || null,
        value: value || null,
        service: service || null,
        comment: comment.trim() || null,
      });
      toast.success("Ditt omdöme är uppdaterat.");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte uppdatera omdömet.",
      );
    }
  }

  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Pencil className="h-4 w-4" /> Redigera mitt omdöme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Redigera ditt omdöme</DialogTitle>
          <DialogDescription>
            {placeName}. Omdömet är ditt och ändringen gäller överallt där
            samma besök och omdöme är synligt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary/60 p-4">
            <RatingInput
              value={overall}
              onChange={setOverall}
              label="Helhetsbetyg"
              size={32}
            />
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium"
              >
                <span>Detaljbetyg (frivilligt)</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <RatingInput value={taste} onChange={setTaste} label="Smak" />
              <RatingInput
                value={value}
                onChange={setValue}
                label="Prisvärdhet"
              />
              <RatingInput
                value={service}
                onChange={setService}
                label="Service"
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-1.5">
            <Label htmlFor={`edit-review-comment-${review.id}`}>
              Kommentar (frivilligt)
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
          <Button
            variant="ghost"
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            Avbryt
          </Button>
          <Button disabled={submitting} onClick={() => void save()}>
            {submitting ? "Sparar…" : "Spara omdöme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
