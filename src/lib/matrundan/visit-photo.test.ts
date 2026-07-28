import { describe, expect, test } from "bun:test";
import { canManageVisitPhoto } from "./visit-photo";

const originalVisit = { linkType: "original" as const, participantIds: ["member-1"] };

describe("behörighet för besöksfoto", () => {
  test("faktisk deltagare får hantera foto", () => {
    expect(canManageVisitPhoto(originalVisit, "member-1", "medlem", false)).toBe(true);
  });

  test("admin får hantera foto även utan deltagande", () => {
    expect(canManageVisitPhoto(originalVisit, "admin-1", "admin", false)).toBe(true);
  });

  test("vanlig medlem utan deltagande nekas", () => {
    expect(canManageVisitPhoto(originalVisit, "member-2", "medlem", false)).toBe(false);
  });

  test("delat besök och arkiverad grupp är alltid skrivskyddade", () => {
    expect(
      canManageVisitPhoto(
        { linkType: "shared", participantIds: ["member-1"] },
        "member-1",
        "ägare",
        false,
      ),
    ).toBe(false);
    expect(canManageVisitPhoto(originalVisit, "member-1", "ägare", true)).toBe(false);
  });
});
