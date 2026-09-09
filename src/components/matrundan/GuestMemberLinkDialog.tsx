import * as React from "react";
import { Loader2, UserRoundCheck } from "lucide-react";
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

    listVisitGuestMemberTargets(sourceGroupId, visitId)
      .then((rows) => {
        if (cancelled) return;
        setTargets(rows);
        const guestIds = [...new Set(rows.map((row) => row.guestId))];
        if (guestIds.length === 1) setSelectedGuestId(guestIds[0]);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Kunde inte läsa deltagare.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sourceGroupId, visitId]);

  const guests = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const target of targets) byId.set(target.guestId, target.guestName);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [targets]);

  const groups = React.useMemo(() => {
    if (!selectedGuestId) return [];
    const byId = new Map<string, { id: string; name: string; emoji: string | null }>();
    for (const target of targets) {
      if (target.guestId !== selectedGuestId) continue;
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

  const chosen = members.find((member) => member.memberId === selectedMemberId) ?? null;

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
          <DialogTitle>Koppla gäst till medlem</DialogTitle>
          <DialogDescription>
            Välj en medlem i en grupp där besöket redan finns. Personen måste själv bekräfta att hen
            var med.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hämtar möjliga deltagare…
          </div>
        ) : loadError ? (
          <div className="py-6 text-sm text-destructive">{loadError}</div>
        ) : targets.length === 0 ? (
          <Card className="space-y-1 rounded-2xl border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium">Ingen möjlig koppling ännu</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Besöket behöver först finnas i en annan aktiv grupp där du också är medlem. Därifrån
              kan en medlem bekräfta sitt deltagande.
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
                <h3 className="text-sm font-medium">3. Vem var med?</h3>
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
      </DialogContent>
    </Dialog>
  );
}
