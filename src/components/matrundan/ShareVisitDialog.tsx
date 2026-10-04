import * as React from "react";
import { toast } from "sonner";
import { Check, Image as ImageIcon, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { listVisitShareTargets, type VisitShareTarget } from "@/lib/matrundan/live-sharing";
import { useSession } from "@/lib/matrundan/session";
import { useVisitShareBatch } from "./useVisitShareBatch";

interface Props {
  visitId: string | null;
  currentGroupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared: () => Promise<void> | void;
}
function canSelect(target: VisitShareTarget) {
  return (
    !target.alreadyLinked ||
    (target.ownHasComment && !target.ownCommentShared) ||
    (target.ownHasPhoto && !target.ownPhotoShared)
  );
}
export function ShareVisitDialog({ visitId, currentGroupId, open, onOpenChange, onShared }: Props) {
  const { userGroups } = useSession();
  const [targets, setTargets] = React.useState<VisitShareTarget[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [shareComment, setShareComment] = React.useState(true);
  const [sharePhoto, setSharePhoto] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [failures, setFailures] = React.useState<
    Array<{ groupId: string; name: string; message: string }>
  >([]);
  const batch = useVisitShareBatch();
  React.useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTargets([]);
    setSelected([]);
    setQuery("");
    setFailures([]);
    setShareComment(true);
    setSharePhoto(true);
    listVisitShareTargets(visitId)
      .then((rows) => {
        if (!cancelled) setTargets(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Kunde inte hämta grupper.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, visitId]);
  const otherGroups = targets.filter((target) => target.groupId !== currentGroupId);
  const chosen = otherGroups.filter((target) => selected.includes(target.groupId));
  const hasComment = chosen.some(
    (target) => target.ownHasComment && (!target.alreadyLinked || !target.ownCommentShared),
  );
  const hasPhoto = chosen.some((target) => target.ownHasPhoto && !target.ownPhotoShared);
  const jobs = chosen.filter(
    (target) =>
      !target.alreadyLinked ||
      (shareComment && target.ownHasComment && !target.ownCommentShared) ||
      (sharePhoto && target.ownHasPhoto && !target.ownPhotoShared),
  );
  async function submit() {
    if (!visitId || submitting || jobs.length === 0) return;
    setSubmitting(true);
    setFailures([]);
    try {
      const results = await batch.run(
        jobs.map((target) => ({
          visitId,
          groupId: target.groupId,
          label: target.name,
          alreadyLinked: target.alreadyLinked,
          shareComment: target.ownHasComment && shareComment,
          sharePhoto: target.ownHasPhoto && sharePhoto,
        })),
      );
      const successful = results.filter((result) => result.status === "success");
      const remaining = results.filter(
        (result) => result.status === "failed" || result.status === "pending",
      );
      setSelected(remaining.map((result) => result.job.groupId));
      setFailures(
        remaining.map((result) => ({
          groupId: result.job.groupId,
          name: result.job.label,
          message: result.error ?? "Inte sparat ännu.",
        })),
      );
      if (successful.length > 0) {
        setTargets((current) =>
          current.map((target) =>
            successful.some((result) => result.job.groupId === target.groupId)
              ? {
                  ...target,
                  alreadyLinked: true,
                  ownCommentShared:
                    target.ownCommentShared || (target.ownHasComment && shareComment),
                  ownPhotoShared: target.ownPhotoShared || (target.ownHasPhoto && sharePhoto),
                }
              : target,
          ),
        );
        toast.success(
          successful.length === 1
            ? `Sparat i ${successful[0].job.label}.`
            : `Sparat i ${successful.length} grupper.`,
        );
        try {
          await onShared();
        } catch {
          toast.warning(
            "Delningen är sparad, men vyn kunde inte uppdateras. Ladda om för att se den.",
          );
        }
      }
      if (remaining.length === 0) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }
  const allSelected = otherGroups
    .filter(canSelect)
    .every((target) => selected.includes(target.groupId));
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!submitting) onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lägg till besöket i fler grupper</DialogTitle>
            <DialogDescription>
              Välj vilka grupper som också ska ha besöket i sin historik.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p role="status" className="py-6 text-sm text-muted-foreground">
              Hämtar grupper…
            </p>
          ) : error ? (
            <p role="alert" className="py-6 text-sm text-destructive">
              {error}
            </p>
          ) : otherGroups.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Du har ingen annan aktiv grupp att lägga till besöket i.
            </p>
          ) : (
            <div className="space-y-2">
              {otherGroups.length > 6 ? (
                <Input
                  aria-label="Sök grupp"
                  placeholder="Sök grupp"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={submitting}
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={submitting || !otherGroups.some(canSelect)}
                onClick={() =>
                  setSelected(
                    allSelected
                      ? []
                      : otherGroups.filter(canSelect).map((target) => target.groupId),
                  )
                }
              >
                {allSelected ? "Rensa val" : "Välj alla"}
              </Button>
              {otherGroups
                .filter((target) =>
                  target.name.toLocaleLowerCase("sv").includes(query.toLocaleLowerCase("sv")),
                )
                .map((target) => {
                  const active = selected.includes(target.groupId);
                  const group = userGroups.find((item) => item.id === target.groupId);
                  const description =
                    group?.description?.trim() || group?.memberPreviewNames?.slice(0, 2).join(", ");
                  return (
                    <button
                      type="button"
                      key={target.groupId}
                      disabled={submitting || !canSelect(target)}
                      aria-pressed={active}
                      onClick={() =>
                        setSelected((current) =>
                          current.includes(target.groupId)
                            ? current.filter((id) => id !== target.groupId)
                            : [...current, target.groupId],
                        )
                      }
                      className={`flex min-h-11 w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left disabled:opacity-60 ${active ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                    >
                      <span className="shrink-0 text-xl" aria-hidden>
                        {target.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium">{target.name}</span>
                        {description ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {description}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {target.alreadyLinked
                            ? "Besöket finns redan"
                            : target.placeExistsInGroup
                              ? "Stället finns i gruppen"
                              : "Stället läggs till"}
                        </span>
                        {active ? (
                          <span className="mt-2 block space-y-1 text-xs text-muted-foreground">
                            {target.alreadyLinked ? (
                              <span className="block">Du kan dela ditt eget innehåll här.</span>
                            ) : (
                              <>
                                <span className="block">
                                  {target.visibleParticipants.length <= 1
                                    ? "Du syns som deltagare."
                                    : `${target.visibleParticipants.map((participant) => participant.name).join(", ")} syns som deltagare.`}
                                  {target.externalParticipantCount > 0
                                    ? ` ${target.externalParticipantCount} ${target.externalParticipantCount === 1 ? "annan deltagare visas" : "andra deltagare visas"} anonymt.`
                                    : ""}
                                </span>
                                <span className="block">
                                  {target.relevantReviewCount === 0
                                    ? "Inga betyg blir synliga."
                                    : `${target.relevantReviewCount} betyg blir ${target.relevantReviewCount === 1 ? "synligt" : "synliga"} i gruppen.`}
                                </span>
                                <span className="block">
                                  {target.sharedVisitsCountForProgression
                                    ? "Besöket räknas för nivåer och utmärkelser."
                                    : "Besöket räknas inte för nivåer eller utmärkelser."}
                                </span>
                              </>
                            )}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-primary" aria-hidden>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
          {hasComment || hasPhoto ? (
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3">
              {hasComment ? (
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <Label htmlFor="share-comment" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    Dela min kommentar
                  </Label>
                  <Switch
                    id="share-comment"
                    checked={shareComment}
                    onCheckedChange={setShareComment}
                    disabled={submitting}
                  />
                </div>
              ) : null}
              {hasPhoto ? (
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <Label htmlFor="share-photo" className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    Dela min bild
                  </Label>
                  <Switch
                    id="share-photo"
                    checked={sharePhoto}
                    onCheckedChange={setSharePhoto}
                    disabled={submitting}
                  />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Valen gäller alla valda grupper. Andras kommentarer och bilder följer inte med.
              </p>
            </div>
          ) : null}
          {failures.length > 0 ? (
            <div role="alert" className="space-y-1 text-sm">
              <p className="font-medium">De här grupperna återstår</p>
              {failures.map((failure) => (
                <p key={failure.groupId} className="break-words text-muted-foreground">
                  {failure.name}: {failure.message}
                </p>
              ))}
              <p className="text-xs text-muted-foreground">
                Lyckade grupper är sparade. Försök igen med de val som återstår.
              </p>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={submitting} onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button
              className="min-h-11"
              onClick={() => void submit()}
              disabled={jobs.length === 0 || submitting}
            >
              {submitting
                ? "Sparar…"
                : failures.length
                  ? "Försök igen"
                  : jobs.length === 0
                    ? "Välj grupp"
                    : jobs.length === 1
                      ? "Spara i vald grupp"
                      : `Spara i ${jobs.length} grupper`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {batch.duplicatePrompt}
    </>
  );
}
