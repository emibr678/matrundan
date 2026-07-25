import * as React from "react";
import { toast } from "sonner";
import { Users2, Sparkles, MessageSquare, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  listVisitShareTargets,
  shareVisitToGroup,
  type VisitShareTarget,
} from "@/lib/matrundan/live-sharing";

interface Props {
  visitId: string | null;
  currentGroupId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onShared: () => Promise<void> | void;
}

/**
 * Dialog för att dela ett besök till en annan grupp där jag är medlem.
 * All data hämtas via list_visit_share_targets: klienten ser aldrig andra
 * gruppers namn, källgrupp eller externa deltagares identiteter.
 */
export function ShareVisitDialog({
  visitId,
  currentGroupId,
  open,
  onOpenChange,
  onShared,
}: Props) {
  const [targets, setTargets] = React.useState<VisitShareTarget[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [shareComment, setShareComment] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTargets(null);
    setSelected(null);
    setShareComment(false);
    listVisitShareTargets(visitId)
      .then((rows) => {
        if (cancelled) return;
        setTargets(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kunde inte hämta grupper.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, visitId]);

  const chosen = targets?.find((t) => t.groupId === selected) ?? null;

  async function submit() {
    if (!visitId || !chosen || submitting) return;
    setSubmitting(true);
    try {
      await shareVisitToGroup(
        visitId,
        chosen.groupId,
        chosen.ownHasComment ? shareComment : false,
      );
      toast.success(`Besöket är tillagt i ${chosen.name}.`);
      await onShared();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte dela besöket.");
    } finally {
      setSubmitting(false);
    }
  }

  const otherGroups = (targets ?? []).filter((t) => t.groupId !== currentGroupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lägg till besöket i en annan grupp</DialogTitle>
          <DialogDescription>
            Bara du och personer med aktivt medlemskap i mottagargruppen syns
            som deltagare. Övriga räknas anonymt.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Laddar grupper…
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : otherGroups.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Du är inte medlem i någon annan aktiv grupp än den här.
          </div>
        ) : (
          <div className="space-y-2">
            {otherGroups.map((t) => {
              const active = selected === t.groupId;
              return (
                <Card
                  key={t.groupId}
                  className={[
                    "rounded-2xl border-border/70 p-0 transition-colors",
                    t.alreadyLinked
                      ? "opacity-60"
                      : active
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/40",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    disabled={t.alreadyLinked}
                    onClick={() => setSelected(t.groupId)}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left outline-none disabled:cursor-not-allowed"
                    aria-pressed={active}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
                      {t.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.alreadyLinked
                          ? "Redan tillagt"
                          : `${t.visibleParticipants.length} deltagare från gruppen`}
                      </div>
                    </div>
                    {t.alreadyLinked ? (
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        Redan tillagt
                      </Badge>
                    ) : null}
                  </button>
                </Card>
              );
            })}
          </div>
        )}

        {chosen && !chosen.alreadyLinked ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Users2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-medium">Deltagare från gruppen</div>
                <div className="mt-0.5 text-muted-foreground">
                  {chosen.visibleParticipants.length > 0
                    ? chosen.visibleParticipants
                        .map((p) =>
                          p.status === "left"
                            ? `${p.name} (tidigare medlem)`
                            : p.name,
                        )
                        .join(", ")
                    : "Ingen av deltagarna är eller har varit medlem i mottagargruppen."}
                  {chosen.externalParticipantCount > 0 ? (
                    <>
                      {" · "}
                      <span>+{chosen.externalParticipantCount} person{chosen.externalParticipantCount === 1 ? "" : "er"} utanför gruppen</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-muted-foreground">
                {chosen.relevantReviewCount} betyg från personer som är eller har
                varit medlemmar blir synliga i gruppen. Kommentarer följer inte
                automatiskt.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-muted-foreground">
                {chosen.sharedVisitsCountForProgression
                  ? "Gruppen räknar delade besök mot progression."
                  : "Gruppen räknar inte delade besök mot progression."}
              </div>
            </div>
            {chosen.ownHasComment ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/50 p-2">
                <Label htmlFor="share-comment" className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Dela min kommentar
                </Label>
                <Switch
                  id="share-comment"
                  checked={shareComment}
                  onCheckedChange={setShareComment}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={submit}
            disabled={!chosen || chosen.alreadyLinked || submitting}
          >
            {submitting ? "Delar…" : chosen ? `Lägg till i ${chosen.name}` : "Välj grupp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
