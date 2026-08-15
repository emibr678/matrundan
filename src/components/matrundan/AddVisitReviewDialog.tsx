import * as React from "react";
import { Loader2, Star } from "lucide-react";
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
import { saveOwnReviewForVisit } from "@/lib/matrundan/live-visit-participation";
import { useSession } from "@/lib/matrundan/session";
import { RatingInput } from "./Rating";

export function AddVisitReviewDialog({
  visitId,
  placeName,
  disabled = false,
  onSaved,
}: {
  visitId: string;
  placeName: string;
  disabled?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const { activeGroupId } = useSession();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [overall, setOverall] = React.useState(0);
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (open) return;
    setOverall(0);
    setTaste(0);
    setValue(0);
    setService(0);
    setComment("");
  }, [open]);

  const ratingsSet = [overall, taste, value, service].filter((rating) => rating > 0).length;

  async function save() {
    if (!activeGroupId) {
      toast.error("Ingen aktiv grupp.");
      return;
    }
    if (overall < 1 || overall > 5) {
      toast.error("Ge ett helhetsbetyg mellan 1 och 5.");
      return;
    }

    setSaving(true);
    try {
      await saveOwnReviewForVisit(activeGroupId, visitId, {
        overall,
        taste: taste || null,
        value: value || null,
        service: service || null,
        comment: comment.trim() || null,
      });
      toast.success("Ditt omdöme är tillagt.");
      setOpen(false);
      await onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara ditt omdöme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          <Star className="h-4 w-4" />
          Lägg till ditt omdöme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ditt omdöme</DialogTitle>
          <DialogDescription>
            {placeName}. Det sparas på samma gemensamma besök — inget nytt besök skapas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary/60 p-4">
            <RatingInput value={overall} onChange={setOverall} label="Helhetsbetyg" size={32} />
          </div>

          <div className="grid gap-4 rounded-2xl border border-border/70 p-4">
            <RatingInput value={taste} onChange={setTaste} label="Smak" />
            <RatingInput value={service} onChange={setService} label="Service" />
            <RatingInput value={value} onChange={setValue} label="Prisvärdhet" />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            {ratingsSet} av 4 betyg satta. Helhetsbetyg krävs; de andra hjälper gruppen att minnas
            upplevelsen bättre men är frivilliga.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor={`visit-review-comment-${visitId}`}>Kommentar (frivilligt)</Label>
            <Textarea
              id={`visit-review-comment-${visitId}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="En liten minnesnotering…"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button disabled={saving || overall === 0} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara omdöme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
