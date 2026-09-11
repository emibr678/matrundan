import * as React from "react";
import { Check, Loader2, UserRoundCheck } from "lucide-react";
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
  listVisitGuestMemberTargets,
  proposeVisitGuestMember,
  type GuestMemberProposalStatus,
  type GuestMemberTarget,
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

function isBlockingProposal(status: GuestMemberProposalStatus | null): boolean {
  return status === "pending" || status === "deferred" || status === "accepted";
}

function linkableGuestIds(targets: GuestMemberTarget[], completedGuestIds: Set<string>): string[] {
  const rowsByGuest = new Map<string, GuestMemberTarget[]>();
  for (const target of targets) {
    const current = rowsByGuest.get(target.guestId) ?? [];
    current.push(target);
    rowsByGuest.set(target.guestId, current);
  }

  return [...rowsByGuest.entries()]
    .filter(([guestId, rows]) => {
      if (completedGuestIds.has(guestId)) return false;
      if (rows.some((row) => isBlockingProposal(row.proposalStatus))) return false;
      return rows.some((row) => row.proposalStatus === null);
    })
    .map(([guestId]) => guestId);
}

export function GuestMemberLinkDialog({
  visitId,
  sourceGroupId,
  open,
  onOpenChange,
}: {
  visitId: string | null;
  sourceGroupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [targets, setTargets] = React.useState<GuestMemberTarget[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedGuestId, setSelectedGuestId] = React.useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [completedGuestIds, setCompletedGuestIds] = React.useState<string[]>([]);
  const [continuation, setContinuation] = React.useState<{ memberName: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !visitId || !sourceGroupId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setTargets([]);
    setSelectedGuestId(null);
    setSelectedGroupId(null);
    setSelectedMemberId(null);
    setCompletedGuestIds([]);
    setContinuation(null);

    listVisitGuestMemberTargets(sourceGroupId, visitId)
      .then((rows) => {
        if (!cancelled) setTargets(rows);
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
  }, [open, sourceGroupId, visitId]);

  const completedGuestIdSet = React.useMemo(() => new Set(completedGuestIds), [completedGuestIds]);
  const availableGuestIds = React.useMemo(
    () => linkableGuestIds(targets, completedGuestIdSet),
    [completedGuestIdSet, targets],
  );
  const guests = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const target of targets) {
      if (availableGuestIds.includes(target.guestId)) {
        byId.set(target.guestId, target.guestName);
      }
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [availableGuestIds, targets]);

  React.useEffect(() => {
    if (continuation) return;
    setSelectedGuestId((current) => {
      if (current && guests.some((guest) => guest.id === current)) return current;
      return guests.length === 1 ? guests[0].id : null;
    });
  }, [continuation, guests]);

  const groups = React.useMemo(() => {
    if (!selectedGuestId) return [];
    const byId = new Map<string, { id: string; name: string; emoji: string | null }>();
    for (const target of targets) {
      if (target.guestId !== selectedGuestId || target.proposalStatus !== null) continue;
      byId.set(target.groupId, {
        id: target.groupId,
        name: target.groupName,
        emoji: target.groupEmoji,
      });
    }
    return [...byId.values()];
  }, [selectedGuestId, targets]);

  React.useEffect(() => {
    setSelectedGroupId((current) => {
      if (current && groups.some((group) => group.id === current)) return current;
      return groups.length === 1 ? groups[0].id : null;
    });
    setSelectedMemberId(null);
  }, [groups]);

  const members = React.useMemo(
    () =>
      targets.filter(
        (target) => target.guestId === selectedGuestId && target.groupId === selectedGroupId,
      ),
    [selectedGroupId, selectedGuestId, targets],
  );

  const chosen =
    members.find(
      (member) => member.memberId === selectedMemberId && member.proposalStatus === null,
    ) ?? null;

  async function submit() {
    if (!visitId || !sourceGroupId || !chosen || submitting) return;
    setSubmitting(true);
    try {
      await proposeVisitGuestMember(
        sourceGroupId,
        visitId,
        chosen.guestId,
        chosen.groupId,
        chosen.memberId,
      );

      const nextCompletedGuestIds = [...new Set([...completedGuestIds, chosen.guestId])];
      let remainingGuestIds: string[] = [];

      try {
        const refreshedTargets = await listVisitGuestMemberTargets(sourceGroupId, visitId);
        setTargets(refreshedTargets);
        remainingGuestIds = linkableGuestIds(refreshedTargets, new Set(nextCompletedGuestIds));
      } catch {
        // Förslaget är redan skapat. Om den gemensamma kapaciteten inte kan
        // verifieras igen erbjuder vi inte en potentiellt inaktuell fortsättning.
      }

      setCompletedGuestIds(nextCompletedGuestIds);
      setSelectedGuestId(null);
      setSelectedGroupId(null);
      setSelectedMemberId(null);

      if (remainingGuestIds.length > 0) {
        setContinuation({ memberName: chosen.memberName });
      } else {
        toast.success(`Frågan är skickad till ${chosen.memberName}.`, {
          description: "Personen bekräftar själv.",
        });
        onOpenChange(false);
      }
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
          <DialogTitle>Koppla gäst till medlem</DialogTitle>
          <DialogDescription>
            Välj vem gästen är i en grupp där besöket redan finns. Personen bekräftar själv.
          </DialogDescription>
        </DialogHeader>

        {continuation ? (
          <Card role="status" className="space-y-2 rounded-2xl border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                aria-hidden
              >
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Frågan är skickad till {continuation.memberName}.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Du kan koppla nästa gäst eller vara klar.
                </p>
              </div>
            </div>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hämtar möjliga deltagare…
          </div>
        ) : loadError ? (
          <div className="py-6 text-sm text-destructive">{loadError}</div>
        ) : targets.length === 0 || guests.length === 0 ? (
          <Card className="space-y-1 rounded-2xl border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium">Ingen möjlig koppling just nu</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Besöket måste finnas i en annan aktiv grupp där du också är medlem. Gäster med en
              väntande eller bekräftad koppling visas inte här.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">1. Vilken gäst?</h3>
              <div className="flex flex-wrap gap-2">
                {guests.map((guest) => (
                  <Button
                    key={guest.id}
                    type="button"
                    size="sm"
                    variant={selectedGuestId === guest.id ? "default" : "outline"}
                    onClick={() => {
                      setSelectedGuestId(guest.id);
                      setSelectedGroupId(null);
                      setSelectedMemberId(null);
                    }}
                  >
                    {guest.name}
                  </Button>
                ))}
              </div>
            </section>

            {selectedGuestId ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">2. I vilken grupp?</h3>
                <div className="space-y-2">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={selectedGroupId === group.id}
                      className={[
                        "flex min-h-11 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                        selectedGroupId === group.id
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-accent/40",
                      ].join(" ")}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setSelectedMemberId(null);
                      }}
                    >
                      <span className="text-lg" aria-hidden>
                        {group.emoji ?? "🍽️"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {group.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedGroupId ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">3. Vem är gästen?</h3>
                <div className="space-y-2">
                  {members.map((member) => {
                    const label = statusLabel(member.proposalStatus);
                    const disabled = member.proposalStatus !== null;
                    return (
                      <button
                        key={member.memberId}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selectedMemberId === member.memberId}
                        className={[
                          "flex min-h-12 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                          disabled
                            ? "cursor-not-allowed border-border/50 opacity-60"
                            : selectedMemberId === member.memberId
                              ? "border-primary bg-primary/5"
                              : "border-border/70 hover:bg-accent/40",
                        ].join(" ")}
                        onClick={() => setSelectedMemberId(member.memberId)}
                      >
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-base"
                          aria-hidden
                        >
                          {member.memberAvatar ?? "🙂"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {member.memberName}
                          </span>
                          {label ? (
                            <span className="block text-xs text-muted-foreground">{label}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {continuation ? (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Klar
            </Button>
            <Button type="button" onClick={() => setContinuation(null)}>
              Koppla en till
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="button" disabled={!chosen || submitting} onClick={() => void submit()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundCheck className="h-4 w-4" />
              )}
              {submitting ? "Skickar…" : "Skicka fråga"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
