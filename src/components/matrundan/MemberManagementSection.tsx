import * as React from "react";
import { Crown, MoreHorizontal, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/matrundan/MemberAvatar";
import { MemberProfileSheet } from "@/components/matrundan/MemberProfileSheet";
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
import { persistDemoState } from "@/lib/matrundan/demo-state";
import {
  executeMemberManagementAction,
  type MemberManagementAction,
} from "@/lib/matrundan/member-management";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
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
          "Personen kan då ändra gruppens inställningar, hantera medlemmar och gruppens rapporterade fel.",
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

function successCopy(action: PendingAction): string {
  switch (action.kind) {
    case "make-admin":
      return `${action.member.name} är nu administratör.`;
    case "make-member":
      return `${action.member.name} är nu medlem.`;
    case "transfer-owner":
      return `Ägarskapet har överförts till ${action.member.name}.`;
    case "remove":
      return `${action.member.name} har tagits bort från gruppen.`;
  }
}

function toMemberAction(action: PendingAction): MemberManagementAction {
  return { kind: action.kind, memberId: action.member.id };
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
  const { state, mode, demoReadOnly } = useStore();
  const { exampleMode } = useSession();
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [profileMemberId, setProfileMemberId] = React.useState<string | null>(null);
  const copy = actionCopy(pendingAction);
  const currentRole = members.find((member) => member.id === currentUserId)?.role;
  const effectiveIsOwner = isOwner || currentRole === "ägare";
  const effectiveIsAdmin = isAdmin || effectiveIsOwner || currentRole === "admin";
  const managementAvailable =
    !demoReadOnly &&
    state.group.lifecycleStatus !== "archived" &&
    (mode === "demo" || Boolean(groupId));
  const profileMember = members.find((member) => member.id === profileMemberId) ?? null;

  async function confirmAction() {
    if (!pendingAction) return;

    const action = pendingAction;
    setBusyId(action.member.id);
    try {
      const nextState = await executeMemberManagementAction({
        mode,
        groupId,
        state,
        action: toMemberAction(action),
      });

      setPendingAction(null);
      toast.success(successCopy(action));

      if (nextState) {
        persistDemoState(nextState, exampleMode);
      } else {
        await onChanged();
        window.dispatchEvent(new Event("matrundan:reload"));
      }
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
          const ownerCanManage =
            managementAvailable && effectiveIsOwner && !isSelf && member.role !== "ägare";
          const adminCanRemove =
            managementAvailable &&
            effectiveIsAdmin &&
            !effectiveIsOwner &&
            !isSelf &&
            member.role === "medlem";
          const canManage = ownerCanManage || adminCanRemove;

          return (
            <div key={member.id} className="flex min-w-0 items-center gap-2 p-2">
              <button
                type="button"
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setProfileMemberId(member.id)}
                aria-label={`Öppna profil för ${member.name}`}
              >
                <MemberAvatar member={member} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {member.name}
                    {isSelf ? " (du)" : ""}
                  </div>
                  <div className="text-xs capitalize text-muted-foreground">{member.role}</div>
                </div>
              </button>

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

      <MemberProfileSheet
        member={profileMember}
        open={profileMember != null}
        onOpenChange={(open) => {
          if (!open) setProfileMemberId(null);
        }}
      />
    </section>
  );
}
