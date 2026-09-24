import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listVisitShareTargets,
  shareOwnVisitPhotoToGroup,
  type VisitShareTarget,
} from "@/lib/matrundan/live-sharing";

export function ShareOwnVisitPhotoDialog({
  visitId,
  currentGroupId,
  open,
  onOpenChange,
  onShared,
}: {
  visitId: string;
  currentGroupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared: () => void | Promise<void>;
}) {
  const [targets, setTargets] = React.useState<VisitShareTarget[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyGroupId, setBusyGroupId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listVisitShareTargets(visitId)
      .then((rows) => {
        if (!cancelled) setTargets(rows);
      })
      .catch((cause) => {
        if (cancelled) return;
        setTargets([]);
        setError(cause instanceof Error ? cause.message : "Kunde inte hämta grupper.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, visitId]);

  const linkedTargets = targets.filter(
    (target) => target.groupId !== currentGroupId && target.alreadyLinked && target.ownHasPhoto,
  );
  const eligibleTargets = linkedTargets.filter((target) => !target.ownPhotoShared);

  async function share(target: VisitShareTarget) {
    if (busyGroupId) return;
    setBusyGroupId(target.groupId);
    try {
      await shareOwnVisitPhotoToGroup(visitId, target.groupId);
      setTargets((current) =>
        current.map((item) =>
          item.groupId === target.groupId ? { ...item, ownPhotoShared: true } : item,
        ),
      );
      toast.success(`Din bild delas nu med ${target.name}.`);
      await onShared();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Kunde inte dela din bild.");
    } finally {
      setBusyGroupId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dela din bild</DialogTitle>
          <DialogDescription>
            Välj en grupp där samma besök redan finns. Bara din bild blir synlig där.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Hämtar grupper…
          </div>
        ) : error ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{error}</p>
        ) : eligibleTargets.length > 0 ? (
          <div className="space-y-2">
            {eligibleTargets.map((target) => (
              <div
                key={target.groupId}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
              >
                <span aria-hidden className="text-lg">
                  {target.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{target.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyGroupId != null}
                  onClick={() => void share(target)}
                >
                  {busyGroupId === target.groupId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Dela
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            {linkedTargets.length > 0
              ? "Din bild är redan delad till de andra grupper där besöket finns."
              : "Besöket finns inte i någon annan av dina grupper ännu."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
