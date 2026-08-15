import { describe, expect, test } from "bun:test";
import { canAddOrReplaceVisitPhoto, canDeleteVisitPhoto, canManageVisitPhoto } from "./visit-photo";

const originalVisit = {
  linkType: "original" as const,
  participantIds: ["member-1", "member-2"],
  photo: null,
};

const photoByMemberOne = {
  url: "data:image/jpeg;base64,fixture",
  uploadedBy: "member-1",
  mimeType: "image/jpeg",
  byteSize: 100,
  width: 100,
  height: 100,
  updatedAt: "2026-08-15T08:00:00.000Z",
};

describe("behörighet för besöksfoto", () => {
  test("faktisk deltagare får lägga första fotot", () => {
    expect(canAddOrReplaceVisitPhoto(originalVisit, "member-1", "medlem", false)).toBe(true);
  });

  test("uppladdaren får ersätta sitt eget foto", () => {
    expect(
      canAddOrReplaceVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "member-1",
        "medlem",
        false,
      ),
    ).toBe(true);
  });

  test("annan deltagare får inte ersätta ett befintligt foto", () => {
    expect(
      canAddOrReplaceVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "member-2",
        "medlem",
        false,
      ),
    ).toBe(false);
  });

  test("owner eller admin får lägga första fotot men inte ersätta en deltagares foto", () => {
    expect(canAddOrReplaceVisitPhoto(originalVisit, "admin-1", "admin", false)).toBe(true);
    expect(
      canAddOrReplaceVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "admin-1",
        "admin",
        false,
      ),
    ).toBe(false);
  });

  test("uppladdaren samt owner eller admin får ta bort fotot", () => {
    const visit = { ...originalVisit, photo: photoByMemberOne };
    expect(canDeleteVisitPhoto(visit, "member-1", "medlem", false)).toBe(true);
    expect(canDeleteVisitPhoto(visit, "admin-1", "admin", false)).toBe(true);
    expect(canDeleteVisitPhoto(visit, "owner-1", "ägare", false)).toBe(true);
  });

  test("annan vanlig deltagare får inte ta bort fotot", () => {
    expect(
      canDeleteVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "member-2",
        "medlem",
        false,
      ),
    ).toBe(false);
  });

  test("vanlig medlem utan deltagande får inte lägga första fotot", () => {
    expect(canAddOrReplaceVisitPhoto(originalVisit, "member-3", "medlem", false)).toBe(false);
  });

  test("delat besök och arkiverad grupp är alltid skrivskyddade", () => {
    const sharedVisit = {
      ...originalVisit,
      linkType: "shared" as const,
      photo: photoByMemberOne,
    };
    expect(canAddOrReplaceVisitPhoto(sharedVisit, "member-1", "ägare", false)).toBe(false);
    expect(canDeleteVisitPhoto(sharedVisit, "member-1", "ägare", false)).toBe(false);
    expect(
      canAddOrReplaceVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "member-1",
        "ägare",
        true,
      ),
    ).toBe(false);
    expect(
      canDeleteVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "member-1",
        "ägare",
        true,
      ),
    ).toBe(false);
  });

  test("kompatibilitetshjälparen betyder att minst en tillåten fotoåtgärd finns", () => {
    expect(
      canManageVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "admin-1",
        "admin",
        false,
      ),
    ).toBe(true);
    expect(
      canManageVisitPhoto(
        { ...originalVisit, photo: photoByMemberOne },
        "member-2",
        "medlem",
        false,
      ),
    ).toBe(false);
  });
});
