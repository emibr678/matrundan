import * as React from "react";
import { Loader2, Undo2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setOwnVisitParticipation } from "@/lib/matrundan/live-visit-participation";
import { useSession } from "@/lib/matrundan/session";
import type { Visit } from "@/lib/matrundan/types";
import { AddVisitReviewDialog } from "./AddVisitReviewDialog";

export function VisitParticipationControls({
  visit,
  placeName,
  currentUserId,
  groupArchived,
  demoReadOnly,
  onChanged,
}: {
  visit: Visit;
  placeName: string;
  currentUserId: string;
  groupArchived: boolean;
  demoReadOnly: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { mode, activeGroupId } = useSession();
  const [confirmDecline, setConfirmDecline] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fallbackParticipant = visit.participantIds.includes(currentUserId);
  const status =
    visit.currentUserParticipationStatus ?? (fallbackParticipant ? "participant" : "none");
  const myReview = visit.visibleReviews?.find((review) => review.userId === currentUserId);
  const writable = mode === "live" && !!activeGroupId && !groupArchived && !demoReadOnly;

  async function updateParticipation(participating: boolean) {
    if (!activeGroupId || !writable) return;
    setSaving(true);
    try {
      await setOwnVisitParticipation(activeGroupId, visit.id, participating);
      toast.success(
        participating ? "Du är åter deltagare på besöket." : "Deltagandet är korrigerat.",
      );
      setConfirmDecline(false);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ändra deltagandet.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "none") return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Din medverkan</h3>

      {status === "participant" ? (
        <Card className="space-y-3 rounded-2xl border-border/70 p-3">
          {!myReview ? (
            <>
              <div>
                <p className="text-sm font-medium">Du var med på besöket</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Lägg gärna till din egen upplevelse. Den sparas på samma gemensamma besök.
                </p>
              </div>
              <AddVisitReviewDialog
                visitId={visit.id}
                placeName={placeName}
                disabled={!writable}
                onSaved={onChanged}
              />
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Du är registrerad som faktisk deltagare på det här besöket.
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center text-muted-foreground"
            disabled={!writable || saving}
            onClick={() => setConfirmDecline(true)}
          >
            <UserMinus className="h-4 w-4" />
            Jag var inte med
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3 rounded-2xl border-border/70 bg-secondary/30 p-3">
          <div>
            <p className="text-sm font-medium">Du har markerat att du inte var med</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Besöket räknas därför inte i din progression och ditt eventuella omdöme visas inte.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!writable || saving}
            onClick={() => void updateParticipation(true)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Jag var med
          </Button>
        </Card>
      )}

      <AlertDialog open={confirmDecline} onOpenChange={setConfirmDecline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Var du inte med på besöket?</AlertDialogTitle>
            <AlertDialogDescription>
              Då tas du bort som deltagare på samma verkliga besök i alla grupper där det visas. Din
              progression räknas om och ditt eventuella omdöme döljs. Du kan återställa deltagandet
              senare om detta var ett misstag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void updateParticipation(false)}>
              {saving ? "Sparar…" : "Ja, jag var inte med"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
