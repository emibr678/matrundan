import * as React from "react";
import { Crown, MoreHorizontal, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/matrundan/MemberAvatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  removeGroupMember,
  setMemberRole,
  transferGroupOwnership,
} from "@/lib/matrundan/live-admin";
import type { Member } from "@/lib/matrundan/types";

type PendingAction =
  | { kind: "make-admin"; member: Member }
  | { kind: "make-member"; member: Member }
  | { kind: "transfer-owner"; member: Member }
  | { kind: "remove"; member: Member };

function actionCopy(action: PendingAction | null): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
} {
  if (!action) {
    return { title: "Hantera medlem", description: "", confirmLabel: "Bekräfta" };
  }

  switch (action.kind) {
    case "make-admin":
      return {
        title: `Gör ${action.member.name} till administratör?`,
        description:
          "Personen kan då ändra gruppens inställningar, bjuda in medlemmar och hantera gruppens rapporterade fel.",
        confirmLabel: "Gör till administratör",
      };
    case "make-member":
      return {
        title: `Gör ${action.member.name} till medlem?`,
        description: "Personen behåller gruppåtkomsten men förlorar administratörens behörigheter.",
        confirmLabel: "Gör till medlem",
      };
    case "transfer-owner":
      return {
        title: `Överför ägarskapet till ${action.member.name}?`,
        description: `Du blir administratör och ${action.member.name} blir gruppens ägare. Endast ägaren kan hantera administratörer och överföra ägarskapet igen.`,
        confirmLabel: "Överför ägarskapet",
      };
    case "remove":
      return {
        title: `Ta bort ${action.member.name} från gruppen?`,
        description:
          "Personen förlorar åtkomsten direkt. Historiska besök och betyg finns kvar i gruppen.",
        confirmLabel: "Ta bort från gruppen",
        destructive: true,
      };
  }
}

export function MemberManagementSection({
  members,
  currentUserId,
  isOwner,
  isAdmin,
  groupId,
  onChanged,
}: {
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
  groupId: string | null;
  onChanged: () => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const copy = actionCopy(pendingAction);

  async function confirmAction() {
    if (!groupId || !pendingAction) return;

    const { member } = pendingAction;
    setBusyId(member.id);
    try {
      switch (pendingAction.kind) {
        case "make-admin":
          await setMemberRole(groupId, member.id, "admin");
          toast.success(`${member.name} är nu administratör.`);
          break;
        case "make-member":
          await setMemberRole(groupId, member.id, "member");
          toast.success(`${member.name} är nu medlem.`);
          break;
        case "transfer-owner":
          await transferGroupOwnership(groupId, member.id);
          toast.success(`Ägarskapet har överförts till ${member.name}.`);
          break;
        case "remove":
          await removeGroupMember(groupId, member.id);
          toast.success(`${member.name} har tagits bort från gruppen.`);
          break;
      }

      await onChanged();
      window.dispatchEvent(new Event("matrundan:reload"));
      setPendingAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ändringen kunde inte genomföras.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Medlemmar & roller</h3>
      <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
        {members.map((member) => {
          const isSelf = member.id === currentUserId;
          const ownerCanManage = isOwner && !isSelf && member.role !== "ägare";
          const adminCanRemove = isAdmin && !isOwner && !isSelf && member.role === "medlem";
          const canManage = Boolean(groupId && (ownerCanManage || adminCanRemove));

          return (
            <div key={member.id} className="flex min-w-0 items-center gap-3 p-3">
              <MemberAvatar member={member} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {member.name}
                  {isSelf ? " (du)" : ""}
                </div>
                <div className="text-xs capitalize text-muted-foreground">{member.role}</div>
              </div>

              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 shrink-0 px-3"
                      disabled={busyId === member.id}
                      aria-label={`Hantera ${member.name}`}
                    >
                      Hantera
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {ownerCanManage && member.role === "medlem" ? (
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => setPendingAction({ kind: "make-admin", member })}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Gör till administratör
                      </DropdownMenuItem>
                    ) : null}
                    {ownerCanManage && member.role === "admin" ? (
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => setPendingAction({ kind: "make-member", member })}
                      >
                        <ShieldOff className="h-4 w-4" />
                        Gör till medlem
                      </DropdownMenuItem>
                    ) : null}
                    {ownerCanManage ? (
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => setPendingAction({ kind: "transfer-owner", member })}
                      >
                        <Crown className="h-4 w-4" />
                        Överför ägarskap
                      </DropdownMenuItem>
                    ) : null}
                    {ownerCanManage || adminCanRemove ? (
                      <DropdownMenuItem
                        className="min-h-11 text-destructive focus:text-destructive"
                        onSelect={() => setPendingAction({ kind: "remove", member })}
                      >
                        <Trash2 className="h-4 w-4" />
                        Ta bort från gruppen
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        })}
      </Card>

      <AlertDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open && !busyId) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId != null}
              className={
                copy.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                void confirmAction();
              }}
            >
              {busyId ? "Sparar…" : copy.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
