import * as React from "react";
import { Loader2 } from "lucide-react";
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
      toast.success("Ditt deltagande är uppdaterat.");
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
      <div
        className="mt-3 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2.5"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-muted-foreground">Ditt deltagande</div>
          <div className="mt-0.5 text-sm font-medium">
            {participating ? "Du var med" : "Du var inte med"}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 px-2.5"
          disabled={!writable || saving}
          onClick={() =>
            participating ? setConfirmDeclineOpen(true) : void updateParticipation(true)
          }
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {participating ? "Jag var inte med" : "Jag var med"}
        </Button>
      </div>

      <AlertDialog open={confirmDeclineOpen} onOpenChange={setConfirmDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Var du inte med?</AlertDialogTitle>
            <AlertDialogDescription>
              Ditt deltagande ändras på samma besök i alla grupper där det visas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={() => void updateParticipation(false)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Markera att jag inte var med
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
