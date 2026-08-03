import { removeGroupMember, setMemberRole, transferGroupOwnership } from "./live-admin";
import type { AppState, Member, Role } from "./types";

export type MemberManagementAction =
  | { kind: "make-admin"; memberId: string }
  | { kind: "make-member"; memberId: string }
  | { kind: "transfer-owner"; memberId: string }
  | { kind: "remove"; memberId: string };

function memberById(state: AppState, memberId: string): Member {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) throw new Error("Medlemmen finns inte längre i gruppen.");
  return member;
}

function requireMutableGroup(state: AppState): void {
  if (state.group.lifecycleStatus === "archived") {
    throw new Error("Gruppen är arkiverad och kan bara läsas.");
  }
}

function requireManageableTarget(
  state: AppState,
  memberId: string,
): {
  actor: Member;
  target: Member;
} {
  const actor = memberById(state, state.currentUserId);
  const target = memberById(state, memberId);
  if (target.id === actor.id) throw new Error("Du kan inte hantera din egen roll här.");
  if (target.role === "ägare") throw new Error("Gruppens ägare kan inte hanteras som medlem.");
  return { actor, target };
}

function withRole(state: AppState, memberId: string, role: Role): AppState {
  return {
    ...state,
    members: state.members.map((member) => (member.id === memberId ? { ...member, role } : member)),
  };
}

export function applyLocalMemberManagementAction(
  state: AppState,
  action: MemberManagementAction,
): AppState {
  requireMutableGroup(state);
  const { actor, target } = requireManageableTarget(state, action.memberId);

  switch (action.kind) {
    case "make-admin":
      if (actor.role !== "ägare") {
        throw new Error("Endast gruppens ägare kan utse administratörer.");
      }
      return withRole(state, target.id, "admin");

    case "make-member":
      if (actor.role !== "ägare") {
        throw new Error("Endast gruppens ägare kan ändra administratörsroller.");
      }
      return withRole(state, target.id, "medlem");

    case "transfer-owner":
      if (actor.role !== "ägare") {
        throw new Error("Endast gruppens ägare kan överföra ägarskapet.");
      }
      return {
        ...state,
        group: { ...state.group, ownerId: target.id },
        members: state.members.map((member) => {
          if (member.id === actor.id) return { ...member, role: "admin" };
          if (member.id === target.id) return { ...member, role: "ägare" };
          return member;
        }),
      };

    case "remove": {
      const actorCanRemove =
        actor.role === "ägare" || (actor.role === "admin" && target.role === "medlem");
      if (!actorCanRemove) {
        throw new Error("Du saknar behörighet att ta bort den här medlemmen.");
      }

      return {
        ...state,
        members: state.members.filter((member) => member.id !== target.id),
        favorites: state.favorites.filter((favorite) => favorite.memberId !== target.id),
        nextStopDateProposal: state.nextStopDateProposal
          ? {
              ...state.nextStopDateProposal,
              responses: state.nextStopDateProposal.responses.filter(
                (response) => response.memberId !== target.id,
              ),
            }
          : state.nextStopDateProposal,
      };
    }
  }
}

export async function executeMemberManagementAction({
  mode,
  groupId,
  state,
  action,
}: {
  mode: "demo" | "live";
  groupId: string | null;
  state: AppState;
  action: MemberManagementAction;
}): Promise<AppState | null> {
  if (mode === "demo") return applyLocalMemberManagementAction(state, action);
  if (!groupId) throw new Error("Ingen aktiv grupp.");

  switch (action.kind) {
    case "make-admin":
      await setMemberRole(groupId, action.memberId, "admin");
      return null;
    case "make-member":
      await setMemberRole(groupId, action.memberId, "member");
      return null;
    case "transfer-owner":
      await transferGroupOwnership(groupId, action.memberId);
      return null;
    case "remove":
      await removeGroupMember(groupId, action.memberId);
      return null;
  }
}
