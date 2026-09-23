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
import { persistDemoState } from "@/lib/matrundan/demo-state";
import { setOwnDemoVisitParticipation } from "@/lib/matrundan/demo-visit-participation";
import { setOwnVisitParticipation } from "@/lib/matrundan/live-visit-participation";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Visit } from "@/lib/matrundan/types";

export function VisitParticipationControls({
  visit,
  currentUserId,
  groupArchived,
  demoReadOnly,
  onChanged,
}: {
  visit: Visit;
  currentUserId: string;
  groupArchived: boolean;
  demoReadOnly: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { state } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
  const [confirmDeclineOpen, setConfirmDeclineOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fallbackParticipant = visit.participantIds.includes(currentUserId);
  const status =
    visit.currentUserParticipationStatus ?? (fallbackParticipant ? "participant" : "none");
  const isRegistrar = visit.createdBy === currentUserId;
  const writable =
    !groupArchived && !demoReadOnly && (mode === "live" ? Boolean(activeGroupId) : true);

  async function updateParticipation(participating: boolean) {
    if (!writable) return;
    setSaving(true);
    try {
      if (mode === "live") {
        if (!activeGroupId) throw new Error("Ingen aktiv grupp.");
        await setOwnVisitParticipation(activeGroupId, visit.id, participating);
      } else {
        persistDemoState(setOwnDemoVisitParticipation(state, visit.id, participating), exampleMode);
      }
      toast.success(
        participating ? "Du är åter deltagare på besöket." : "Deltagandet är korrigerat.",
      );
      setConfirmDeclineOpen(false);
      if (mode === "live") await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ändra deltagandet.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "none" || isRegistrar) return null;

  const participating = status === "participant";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-10 w-full justify-start px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
        disabled={!writable || saving}
        onClick={() =>
          participating ? setConfirmDeclineOpen(true) : void updateParticipation(true)
        }
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : participating ? (
          <UserMinus className="h-4 w-4" />
        ) : (
          <Undo2 className="h-4 w-4" />
        )}
        {participating ? "Jag var inte med" : "Jag var med"}
      </Button>

      <AlertDialog open={confirmDeclineOpen} onOpenChange={setConfirmDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Var du inte med på besöket?</AlertDialogTitle>
            <AlertDialogDescription>
              Då tas du bort som deltagare på samma verkliga besök i alla grupper där det visas.
              Din progression räknas om och ditt eventuella omdöme döljs. Du kan återställa
              deltagandet senare om detta var ett misstag.
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
    </>
  );
}
