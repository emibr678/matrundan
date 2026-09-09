import * as React from "react";
import { Loader2, UserRoundPlus } from "lucide-react";
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
import {
  listSharedVisitMemberCandidates,
  proposeSharedVisitMember,
  type GuestMemberProposalStatus,
  type SharedVisitMemberCandidate,
} from "@/lib/matrundan/live-visit-guest-members";

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
  const [candidates, setCandidates] = React.useState<SharedVisitMemberCandidate[]>([]);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !visitId) return;
    setSelectedMemberId(null);
    setLoadError(null);

    if (!groupId) {
      setCandidates(demoCandidates ?? []);
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
  }, [demoCandidates, groupId, open, visitId]);

  const chosen = candidates.find((candidate) => candidate.memberId === selectedMemberId) ?? null;

  async function submit() {
    if (!visitId || !chosen || submitting) return;
    setSubmitting(true);
    try {
      if (groupId) {
        await proposeSharedVisitMember(groupId, visitId, chosen.memberId);
      }
      toast.success(`Frågan är skickad till ${chosen.memberName}.`, {
        description: "Personen behöver själv bekräfta att hen var med.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka frågan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Föreslå deltagare</DialogTitle>
          <DialogDescription>
            Välj någon i den här gruppen som du vet var med på besöket. Personen får själv
            bekräfta innan deltagandet räknas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hämtar gruppens medlemmar…
          </div>
        ) : loadError ? (
          <div className="py-6 text-sm text-destructive">{loadError}</div>
        ) : candidates.length === 0 ? (
          <Card className="space-y-1 rounded-2xl border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium">Ingen att föreslå just nu</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Alla möjliga deltagare är redan registrerade, har ett väntande förslag eller så finns
              ingen okopplad gäst kvar på besöket.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => {
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
                    <span className="block truncate text-sm font-medium">{candidate.memberName}</span>
                    {label ? (
                      <span className="block text-xs text-muted-foreground">{label}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={!chosen || submitting} onClick={() => void submit()}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserRoundPlus className="h-4 w-4" />
            )}
            {submitting ? "Skickar…" : "Skicka fråga"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
