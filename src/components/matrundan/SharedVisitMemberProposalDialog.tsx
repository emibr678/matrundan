import * as React from "react";
import { Check, Loader2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { persistDemoState } from "@/lib/matrundan/demo-state";
import { acceptOwnDemoGuestParticipation } from "@/lib/matrundan/demo-visit-participation";
import {
  confirmSharedVisitSelf,
  listSharedVisitMemberCandidates,
  proposeSharedVisitMember,
  type GuestMemberProposalStatus,
  type SharedVisitMemberCandidate,
} from "@/lib/matrundan/live-visit-guest-members";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

function statusLabel(status: GuestMemberProposalStatus | null): string | null {
  switch (status) {
    case "pending":
      return "Väntar på svar";
    case "deferred":
      return "Svarar senare";
    case "declined":
      return "Har svarat nej";
    case "accepted":
      return "Bekräftad";
    default:
      return null;
  }
}

export function SharedVisitMemberProposalDialog({
  visitId,
  groupId,
  open,
  onOpenChange,
  demoCandidates,
}: {
  visitId: string | null;
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demoCandidates?: SharedVisitMemberCandidate[];
}) {
  const { state, demoReadOnly } = useStore();
  const { exampleMode } = useSession();
  const [candidates, setCandidates] = React.useState<SharedVisitMemberCandidate[]>([]);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmingSelf, setConfirmingSelf] = React.useState(false);

  const demoSelfCandidate = React.useMemo<SharedVisitMemberCandidate | null>(() => {
    if (groupId || !visitId) return null;
    const visit = state.visits.find((item) => item.id === visitId);
    if (
      !visit ||
      visit.participantIds.includes(state.currentUserId) ||
      (visit.externalParticipantCount ?? 0) < 1
    ) {
      return null;
    }
    const member = state.members.find((item) => item.id === state.currentUserId);
    if (!member) return null;
    return {
      memberId: member.id,
      memberName: member.name,
      memberAvatar: member.avatar ?? null,
      memberAvatarImage: member.avatarImage ?? null,
      proposalStatus: null,
    };
  }, [groupId, state.currentUserId, state.members, state.visits, visitId]);

  React.useEffect(() => {
    if (!open || !visitId) return;
    setSelectedMemberId(null);
    setLoadError(null);

    if (!groupId) {
      setCandidates([
        ...(demoSelfCandidate ? [demoSelfCandidate] : []),
        ...(demoCandidates ?? []).filter(
          (candidate) => candidate.memberId !== demoSelfCandidate?.memberId,
        ),
      ]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setCandidates([]);
    listSharedVisitMemberCandidates(groupId, visitId)
      .then((rows) => {
        if (!cancelled) setCandidates(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Kunde inte läsa deltagare.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demoCandidates, demoSelfCandidate, groupId, open, visitId]);

  const selfCandidate =
    candidates.find((candidate) => candidate.memberId === state.currentUserId) ?? null;
  const selfCanConfirm =
    !!selfCandidate &&
    (selfCandidate.proposalStatus === null || selfCandidate.proposalStatus === "declined");
  const otherCandidates = candidates.filter(
    (candidate) => candidate.memberId !== state.currentUserId,
  );
  const chosen =
    otherCandidates.find((candidate) => candidate.memberId === selectedMemberId) ?? null;

  async function reload() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("matrundan:reload"));
    }
  }

  async function confirmSelf() {
    if (!visitId || !selfCanConfirm || confirmingSelf || demoReadOnly) return;
    setConfirmingSelf(true);
    try {
      if (groupId) {
        await confirmSharedVisitSelf(groupId, visitId);
      } else {
        persistDemoState(acceptOwnDemoGuestParticipation(state, visitId), exampleMode);
      }
      toast.success("Du är tillagd som deltagare.");
      onOpenChange(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till dig.");
    } finally {
      setConfirmingSelf(false);
    }
  }

  async function submit() {
    if (!visitId || !chosen || submitting) return;
    setSubmitting(true);
    try {
      if (groupId) {
        await proposeSharedVisitMember(groupId, visitId, chosen.memberId);
      }
      toast.success(`Frågan är skickad till ${chosen.memberName}.`, {
        description: "Personen bekräftar själv.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka frågan.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasAnyOption = selfCanConfirm || otherCandidates.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till deltagare</DialogTitle>
          <DialogDescription>
            Var du själv med kan du lägga till dig direkt. Annars kan du föreslå någon annan.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hämtar gruppens medlemmar…
          </div>
        ) : loadError ? (
          <div className="py-6 text-sm text-destructive">{loadError}</div>
        ) : !hasAnyOption ? (
          <Card className="space-y-1 rounded-2xl border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium">Ingen att lägga till just nu</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Alla möjliga deltagare är redan registrerade eller har en fråga som väntar.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {selfCanConfirm ? (
              <Card className="flex items-center gap-3 rounded-2xl border-primary/25 bg-primary/5 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Var du själv med?</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={confirmingSelf || demoReadOnly}
                  onClick={() => void confirmSelf()}
                >
                  {confirmingSelf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {confirmingSelf ? "Lägger till…" : "Ja, lägg till mig"}
                </Button>
              </Card>
            ) : null}

            {otherCandidates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Föreslå någon annan</p>
                {otherCandidates.map((candidate) => {
                  const label = statusLabel(candidate.proposalStatus);
                  const disabled = candidate.proposalStatus !== null;
                  return (
                    <button
                      key={candidate.memberId}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selectedMemberId === candidate.memberId}
                      className={[
                        "flex min-h-12 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                        disabled
                          ? "cursor-not-allowed border-border/50 opacity-60"
                          : selectedMemberId === candidate.memberId
                            ? "border-primary bg-primary/5"
                            : "border-border/70 hover:bg-accent/40",
                      ].join(" ")}
                      onClick={() => setSelectedMemberId(candidate.memberId)}
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-base"
                        aria-hidden
                      >
                        {candidate.memberAvatarImage ? (
                          <img
                            src={candidate.memberAvatarImage}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (candidate.memberAvatar ?? "🙂")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {candidate.memberName}
                        </span>
                        {label ? (
                          <span className="block text-xs text-muted-foreground">{label}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {otherCandidates.length > 0 ? "Avbryt" : "Stäng"}
          </Button>
          {otherCandidates.length > 0 ? (
            <Button type="button" disabled={!chosen || submitting} onClick={() => void submit()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundPlus className="h-4 w-4" />
              )}
              {submitting ? "Skickar…" : "Skicka fråga"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
