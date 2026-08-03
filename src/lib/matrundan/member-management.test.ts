import { describe, expect, test } from "bun:test";

import { EXAMPLE_STATE } from "./example-data";
import { applyLocalMemberManagementAction } from "./member-management";

function freshState() {
  return structuredClone(EXAMPLE_STATE);
}

describe("lokal medlemshantering", () => {
  test("ägaren kan utse administratör och överföra ägarskapet", () => {
    const initial = freshState();
    const robin = initial.members.find((member) => member.name === "Robin");
    expect(robin).toBeDefined();

    const promoted = applyLocalMemberManagementAction(initial, {
      kind: "make-admin",
      memberId: robin!.id,
    });
    expect(promoted.members.find((member) => member.id === robin!.id)?.role).toBe("admin");

    const transferred = applyLocalMemberManagementAction(promoted, {
      kind: "transfer-owner",
      memberId: robin!.id,
    });
    expect(transferred.group.ownerId).toBe(robin!.id);
    expect(transferred.members.find((member) => member.id === robin!.id)?.role).toBe("ägare");
    expect(
      transferred.members.find((member) => member.id === transferred.currentUserId)?.role,
    ).toBe("admin");
  });

  test("en administratör kan inte ändra roller eller ta bort en annan administratör", () => {
    const initial = freshState();
    const admin = initial.members.find((member) => member.role === "admin");
    const member = initial.members.find((item) => item.role === "medlem");
    expect(admin).toBeDefined();
    expect(member).toBeDefined();

    const adminState = {
      ...initial,
      currentUserId: admin!.id,
    };

    expect(() =>
      applyLocalMemberManagementAction(adminState, {
        kind: "make-admin",
        memberId: member!.id,
      }),
    ).toThrow("Endast gruppens ägare");

    const otherAdminState = {
      ...adminState,
      members: adminState.members.map((item) =>
        item.id === member!.id ? { ...item, role: "admin" as const } : item,
      ),
    };
    expect(() =>
      applyLocalMemberManagementAction(otherAdminState, {
        kind: "remove",
        memberId: member!.id,
      }),
    ).toThrow("saknar behörighet");
  });

  test("borttagning bevarar historiska besök och omdömen men rensar aktiv medlemsdata", () => {
    const initial = freshState();
    const member = initial.members.find((item) => item.role === "medlem");
    expect(member).toBeDefined();

    const beforeVisits = structuredClone(initial.visits);
    const beforeActivity = structuredClone(initial.activity);
    const state = {
      ...initial,
      favorites: [...initial.favorites, { memberId: member!.id, placeId: initial.places[0]!.id }],
      nextStopDateProposal: initial.nextStopDateProposal
        ? {
            ...initial.nextStopDateProposal,
            responses: [
              ...initial.nextStopDateProposal.responses,
              {
                memberId: member!.id,
                response: "fits" as const,
                updatedAt: "2026-08-03T00:00:00.000Z",
              },
            ],
          }
        : null,
    };

    const next = applyLocalMemberManagementAction(state, {
      kind: "remove",
      memberId: member!.id,
    });

    expect(next.members.some((item) => item.id === member!.id)).toBe(false);
    expect(next.favorites.some((favorite) => favorite.memberId === member!.id)).toBe(false);
    expect(
      next.nextStopDateProposal?.responses.some((response) => response.memberId === member!.id),
    ).toBe(false);
    expect(next.visits).toEqual(beforeVisits);
    expect(next.activity).toEqual(beforeActivity);
  });
});
