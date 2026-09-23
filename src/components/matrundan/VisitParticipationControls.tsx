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
  open,
  onOpenChange,
  onChanged,
}: {
  visit: Visit;
  currentUserId: string;
  groupArchived: boolean;
  demoReadOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void | Promise<void>;
}) {
  const { state } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
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
      onOpenChange(false);
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ändra ditt deltagande</AlertDialogTitle>
          <AlertDialogDescription>
            {participating
              ? "Du är registrerad som deltagare på det här besöket. Om det inte stämmer kan du markera att du inte var med."
              : "Du är inte registrerad som deltagare på det här besöket. Om det var ett misstag kan du markera att du var med."}
            {" Ändringen gäller samma besök i alla grupper där det visas."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={() => void updateParticipation(!participating)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {participating ? "Markera att jag inte var med" : "Markera att jag var med"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
