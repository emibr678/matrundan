import { describe, expect, test } from "bun:test";
import { canDeleteOriginalVisit, canEditOriginalVisit } from "./visit-permissions";

const originalVisit = { createdBy: "creator", linkType: "original" as const };

describe("behörighet för att radera originalbesök", () => {
  test("registraren, ägare och admin får radera", () => {
    expect(canDeleteOriginalVisit(originalVisit, "creator", "medlem", false)).toBe(true);
    expect(canDeleteOriginalVisit(originalVisit, "owner", "ägare", false)).toBe(true);
    expect(canDeleteOriginalVisit(originalVisit, "admin", "admin", false)).toBe(true);
  });

  test("andra medlemmar, delade besök och arkiverade grupper nekas", () => {
    expect(canDeleteOriginalVisit(originalVisit, "member", "medlem", false)).toBe(false);
    expect(
      canDeleteOriginalVisit(
        { createdBy: "creator", linkType: "shared" },
        "creator",
        "ägare",
        false,
      ),
    ).toBe(false);
    expect(canDeleteOriginalVisit(originalVisit, "creator", "ägare", true)).toBe(false);
  });
});

describe("behörighet för att redigera originalbesök", () => {
  test("bara registreraren får redigera den kanoniska händelsen", () => {
    expect(canEditOriginalVisit(originalVisit, "creator", false)).toBe(true);
    expect(canEditOriginalVisit(originalVisit, "owner", false)).toBe(false);
    expect(canEditOriginalVisit(originalVisit, "admin", false)).toBe(false);
  });

  test("delade besök och arkiverade grupper nekas även för registreraren", () => {
    expect(
      canEditOriginalVisit({ createdBy: "creator", linkType: "shared" }, "creator", false),
    ).toBe(false);
    expect(canEditOriginalVisit(originalVisit, "creator", true)).toBe(false);
  });
});
