import { describe, expect, test } from "bun:test";
import {
  canAddOrReplaceVisitPhoto,
  canDeleteVisitPhoto,
  canManageVisitPhoto,
  getOwnVisitPhoto,
  getVisitPhotos,
  representativeVisitPhoto,
} from "./visit-photo";

const photoByMemberOne = {
  url: "data:image/jpeg;base64,one",
  uploadedBy: "member-1",
  mimeType: "image/jpeg",
  byteSize: 100,
  width: 100,
  height: 100,
  createdAt: "2026-08-15T08:00:00.000Z",
  updatedAt: "2026-08-15T08:00:00.000Z",
};

const photoByMemberTwo = {
  url: "data:image/jpeg;base64,two",
  uploadedBy: "member-2",
  mimeType: "image/jpeg",
  byteSize: 120,
  width: 100,
  height: 100,
  createdAt: "2026-08-15T09:00:00.000Z",
  updatedAt: "2026-08-15T09:00:00.000Z",
};

const originalVisit = {
  linkType: "original" as const,
  participantIds: ["member-1", "member-2"],
  photos: [photoByMemberOne],
  photo: photoByMemberOne,
};

describe("behörighet för besöksbilder", () => {
  test("varje faktisk deltagare får lägga till eller ersätta sin egen bild", () => {
    expect(
      canAddOrReplaceVisitPhoto(
        originalVisit,
        "member-1",
        "medlem",
        false,
      ),
    ).toBe(true);
    expect(
      canAddOrReplaceVisitPhoto(
        originalVisit,
        "member-2",
        "medlem",
        false,
      ),
    ).toBe(true);
  });

  test("owner eller admin utan faktisk närvaro får inte bidra med en bild", () => {
    expect(
      canAddOrReplaceVisitPhoto(
        originalVisit,
        "admin-1",
        "admin",
        false,
      ),
    ).toBe(false);
    expect(
      canAddOrReplaceVisitPhoto(
        originalVisit,
        "owner-1",
        "ägare",
        false,
      ),
    ).toBe(false);
  });

  test("uppladdaren får ta bort sin bild och owner/admin får moderera andras", () => {
    expect(
      canDeleteVisitPhoto(
        originalVisit,
        "member-1",
        "member-1",
        "medlem",
        false,
      ),
    ).toBe(true);
    expect(
      canDeleteVisitPhoto(
        originalVisit,
        "member-1",
        "admin-1",
        "admin",
        false,
      ),
    ).toBe(true);
    expect(
      canDeleteVisitPhoto(
        originalVisit,
        "member-1",
        "owner-1",
        "ägare",
        false,
      ),
    ).toBe(true);
  });

  test("annan vanlig deltagare får inte ta bort någon annans bild", () => {
    expect(
      canDeleteVisitPhoto(
        originalVisit,
        "member-1",
        "member-2",
        "medlem",
        false,
      ),
    ).toBe(false);
  });

  test("en saknad målbild kan inte modereras", () => {
    expect(
      canDeleteVisitPhoto(
        originalVisit,
        "member-2",
        "admin-1",
        "admin",
        false,
      ),
    ).toBe(false);
  });

  test("delat besök och arkiverad grupp är skrivskyddade", () => {
    const sharedVisit = { ...originalVisit, linkType: "shared" as const };

    expect(
      canAddOrReplaceVisitPhoto(
        sharedVisit,
        "member-1",
        "ägare",
        false,
      ),
    ).toBe(false);
    expect(
      canDeleteVisitPhoto(
        sharedVisit,
        "member-1",
        "member-1",
        "ägare",
        false,
      ),
    ).toBe(false);
    expect(
      canAddOrReplaceVisitPhoto(
        originalVisit,
        "member-1",
        "ägare",
        true,
      ),
    ).toBe(false);
    expect(
      canDeleteVisitPhoto(
        originalVisit,
        "member-1",
        "member-1",
        "ägare",
        true,
      ),
    ).toBe(false);
  });

  test("galleriet sorteras stabilt och hittar egen samt representativ bild", () => {
    const visit = {
      ...originalVisit,
      photos: [photoByMemberTwo, photoByMemberOne],
      photo: photoByMemberTwo,
    };

    expect(getVisitPhotos(visit).map((photo) => photo.uploadedBy)).toEqual([
      "member-1",
      "member-2",
    ]);
    expect(getOwnVisitPhoto(visit, "member-2")?.uploadedBy).toBe("member-2");
    expect(representativeVisitPhoto(visit)?.uploadedBy).toBe("member-1");
  });

  test("legacyfältet photo fungerar när photos ännu saknas", () => {
    const legacy = {
      linkType: "original" as const,
      participantIds: ["member-1"],
      photo: photoByMemberOne,
    };

    expect(getVisitPhotos(legacy)).toEqual([photoByMemberOne]);
    expect(representativeVisitPhoto(legacy)).toEqual(photoByMemberOne);
  });

  test("kompatibilitetshjälparen betyder att minst en tillåten fotoåtgärd finns", () => {
    expect(
      canManageVisitPhoto(
        originalVisit,
        "member-2",
        "medlem",
        false,
      ),
    ).toBe(true);
    expect(
      canManageVisitPhoto(
        originalVisit,
        "admin-1",
        "admin",
        false,
      ),
    ).toBe(true);
    expect(
      canManageVisitPhoto(
        originalVisit,
        "member-3",
        "medlem",
        false,
      ),
    ).toBe(false);
  });
});
