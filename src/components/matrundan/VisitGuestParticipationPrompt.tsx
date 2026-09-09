import * as React from "react";
import { Check, Clock3, Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { persistDemoState } from "@/lib/matrundan/demo-state";
import { acceptOwnDemoGuestParticipation } from "@/lib/matrundan/demo-visit-participation";
import {
  getOwnVisitGuestProposal,
  respondVisitGuestProposal,
  type GuestMemberProposalResponse,
  type OwnGuestMemberProposal,
} from "@/lib/matrundan/live-visit-guest-members";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

export function VisitGuestParticipationPrompt({
  visitId,
  groupId,
  groupArchived,
  onChanged,
  demoPending = false,
}: {
  visitId: string;
  groupId: string | null;
  groupArchived: boolean;
  onChanged: () => void | Promise<void>;
  demoPending?: boolean;
}) {
  const { state, demoReadOnly } = useStore();
  const { mode, exampleMode } = useSession();
  const [proposal, setProposal] = React.useState<OwnGuestMemberProposal | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<GuestMemberProposalResponse | null>(null);
  const [expandedDeferred, setExpandedDeferred] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProposal(null);
    setExpandedDeferred(false);

    if (mode !== "live") {
      setProposal(
        demoPending
          ? {
              proposalId: `demo-guest-proposal:${visitId}`,
              status: "pending",
            }
          : null,
      );
      setLoading(false);
      return;
    }

    if (!groupId) {
      setLoading(false);
      return;
    }

    getOwnVisitGuestProposal(groupId, visitId)
      .then((result) => {
        if (!cancelled) setProposal(result);
      })
      .catch(() => {
        // Detta är en sekundär prompt på ett i övrigt läsbart besök. En tillfälligt
        // otillgänglig RPC ska därför inte blockera eller ersätta besöksdetaljen.
        if (!cancelled) setProposal(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demoPending, groupId, mode, visitId]);

  async function respond(response: GuestMemberProposalResponse) {
    if (!proposal || saving || groupArchived || demoReadOnly) return;
    setSaving(response);
    try {
      if (mode === "live") {
        if (!groupId) throw new Error("Ingen aktiv grupp.");
        await respondVisitGuestProposal(groupId, proposal.proposalId, response);
      } else if (response === "accept") {
        persistDemoState(acceptOwnDemoGuestParticipation(state, visitId), exampleMode);
      }

      if (response === "accept") {
        toast.success("Ditt deltagande är bekräftat.", {
          description: "Besöket räknas nu som ett besök du faktiskt var med på.",
        });
        setProposal(null);
        await onChanged();
      } else if (response === "decline") {
        toast.success("Tack, deltagandeförslaget är avvisat.");
        setProposal(null);
      } else {
        setProposal({ ...proposal, status: "deferred" });
        setExpandedDeferred(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara ditt svar.");
    } finally {
      setSaving(null);
    }
  }

  if (loading || !proposal || groupArchived) return null;

  if (proposal.status === "deferred" && !expandedDeferred) {
    return (
      <Card
        className="flex items-center gap-3 rounded-2xl border-border/70 bg-secondary/25 p-3"
        aria-label="Deltagandeförslag väntar på svar"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
          aria-hidden
        >
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Deltagande väntar på svar</p>
          <p className="text-xs text-muted-foreground">Du valde att svara senare.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setExpandedDeferred(true)}>
          Svara nu
        </Button>
      </Card>
    );
  }

  return (
    <Card
      className="space-y-3 rounded-2xl border-primary/25 bg-primary/5 p-4"
      aria-label="Bekräfta deltagande"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Var du med på det här besöket?</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          En medlem i gruppen tror att du var med. Bekräfta bara om det stämmer. Ditt svar gäller
          samma verkliga besök som redan visas här.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          className="w-full"
          disabled={saving !== null || demoReadOnly}
          onClick={() => void respond("accept")}
        >
          {saving === "accept" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Ja, jag var med
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={saving !== null || demoReadOnly}
          onClick={() => void respond("decline")}
        >
          {saving === "decline" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserMinus className="h-4 w-4" />
          )}
          Jag var inte med
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full text-muted-foreground"
        disabled={saving !== null || demoReadOnly}
        onClick={() => void respond("defer")}
      >
        {saving === "defer" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Inte nu
      </Button>
    </Card>
  );
}
