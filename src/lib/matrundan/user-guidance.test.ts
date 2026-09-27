import { describe, expect, test } from "bun:test";
import {
  guidanceIdentifier,
  guidanceRowsToIdentifiers,
  shouldAutoShowCoreIntro,
  USER_GUIDANCE,
} from "./user-guidance";

describe("user guidance", () => {
  test("har stabila versionsstyrda identifierare", () => {
    expect(guidanceIdentifier(USER_GUIDANCE.coreIntro)).toBe("core-intro@1");
    expect(guidanceIdentifier(USER_GUIDANCE.occasionGuide)).toBe(
      "occasion-guide@1",
    );
  });

  test("översätter databasrader utan gruppberoende", () => {
    expect(
      guidanceRowsToIdentifiers([
        { guidance_key: "core-intro", guidance_version: 1 },
        { guidance_key: "occasion-guide", guidance_version: 1 },
      ]),
    ).toEqual(new Set(["core-intro@1", "occasion-guide@1"]));
  });

  test("registret innehåller unika nyckel- och versionspar", () => {
    const identifiers = Object.values(USER_GUIDANCE).map(guidanceIdentifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  test("visar kärnintroduktionen först när alla automatiska grindar är klara", () => {
    const eligible = {
      isLive: true,
      hasUser: true,
      hasActiveGroup: true,
      onHomeRoute: true,
      pendingInvitationsReady: true,
      pendingInvitationCount: 0,
      guidanceReady: true,
      acknowledged: false,
      alreadyHandled: false,
    };

    expect(shouldAutoShowCoreIntro(eligible)).toBe(true);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, pendingInvitationsReady: false }),
    ).toBe(false);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, pendingInvitationCount: 1 }),
    ).toBe(false);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, hasActiveGroup: false }),
    ).toBe(false);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, onHomeRoute: false }),
    ).toBe(false);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, guidanceReady: false }),
    ).toBe(false);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, acknowledged: true }),
    ).toBe(false);
    expect(
      shouldAutoShowCoreIntro({ ...eligible, alreadyHandled: true }),
    ).toBe(false);
  });
});
