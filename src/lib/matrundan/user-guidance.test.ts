import { describe, expect, test } from "bun:test";
import {
  guidanceAcknowledgedForPresentation,
  guidanceIdentifier,
  guidanceRowsToIdentifiers,
  resolveGuidanceAcknowledgementAction,
  setGuidancePreview,
  shouldAutoShowCoreIntro,
  shouldShowPersonalJourneyIntro,
  USER_GUIDANCE,
} from "./user-guidance";

describe("user guidance", () => {
  test("har stabila versionsstyrda identifierare", () => {
    expect(guidanceIdentifier(USER_GUIDANCE.coreIntro)).toBe("core-intro@2");
    expect(guidanceIdentifier(USER_GUIDANCE.reviewContext)).toBe("review-context@2");
    expect(guidanceIdentifier(USER_GUIDANCE.personalJourneyIntro)).toBe(
      "personal-journey-intro@1",
    );
  });

  test("översätter databasrader utan gruppberoende", () => {
    expect(
      guidanceRowsToIdentifiers([
        { guidance_key: "core-intro", guidance_version: 1 },
        { guidance_key: "review-context", guidance_version: 1 },
      ]),
    ).toEqual(new Set(["core-intro@1", "review-context@1"]));
  });

  test("Typ av upplevelse och omdömen använder ett gemensamt första-gångenkvitto", () => {
    expect(guidanceIdentifier(USER_GUIDANCE.reviewContext)).toBe("review-context@2");
  });

  test("låter alla användare få version 2 en gång även om version 1 är kvitterad", () => {
    const legacyAcknowledgements = new Set(["core-intro@1", "review-context@1"] as const);

    expect(
      guidanceAcknowledgedForPresentation(
        legacyAcknowledgements,
        new Set(),
        USER_GUIDANCE.coreIntro,
      ),
    ).toBe(false);
    expect(
      guidanceAcknowledgedForPresentation(
        legacyAcknowledgements,
        new Set(),
        USER_GUIDANCE.reviewContext,
      ),
    ).toBe(false);
  });

  test("registret innehåller unika nyckel- och versionspar", () => {
    const identifiers = Object.values(USER_GUIDANCE).map(guidanceIdentifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  test("kan simulera osedd guide utan att ändra beständiga kvitton", () => {
    const acknowledged = new Set(["review-context@2"] as const);
    const previews = setGuidancePreview(new Set(), USER_GUIDANCE.reviewContext, true);

    expect(
      guidanceAcknowledgedForPresentation(acknowledged, previews, USER_GUIDANCE.reviewContext),
    ).toBe(false);
    expect(acknowledged).toEqual(new Set(["review-context@2"]));
    expect(setGuidancePreview(previews, USER_GUIDANCE.reviewContext, false)).toEqual(new Set());
  });

  test("kvittering av preview avslutar simuleringen utan databasväg", () => {
    expect(
      resolveGuidanceAcknowledgementAction({
        hasUser: true,
        persistedAcknowledged: false,
        previewing: true,
      }),
    ).toBe("finish-preview");
    expect(
      resolveGuidanceAcknowledgementAction({
        hasUser: true,
        persistedAcknowledged: true,
        previewing: true,
      }),
    ).toBe("finish-preview");
    expect(
      resolveGuidanceAcknowledgementAction({
        hasUser: true,
        persistedAcknowledged: false,
        previewing: false,
      }),
    ).toBe("persist");
    expect(
      resolveGuidanceAcknowledgementAction({
        hasUser: true,
        persistedAcknowledged: true,
        previewing: false,
      }),
    ).toBe("ignore");
  });

  test("visar Min matresa-introt först när flera aktiva grupper gör det relevant", () => {
    const eligible = {
      isLive: true,
      activeGroupCount: 2,
      guidanceReady: true,
      coreIntroAcknowledged: true,
      acknowledged: false,
      productTourActive: false,
    };

    expect(shouldShowPersonalJourneyIntro(eligible)).toBe(true);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, activeGroupCount: 1 })).toBe(false);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, guidanceReady: false })).toBe(false);
    expect(
      shouldShowPersonalJourneyIntro({ ...eligible, coreIntroAcknowledged: false }),
    ).toBe(false);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, acknowledged: true })).toBe(false);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, productTourActive: true })).toBe(false);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, isLive: false })).toBe(false);
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
    expect(shouldAutoShowCoreIntro({ ...eligible, pendingInvitationsReady: false })).toBe(false);
    expect(shouldAutoShowCoreIntro({ ...eligible, pendingInvitationCount: 1 })).toBe(false);
    expect(shouldAutoShowCoreIntro({ ...eligible, hasActiveGroup: false })).toBe(false);
    expect(shouldAutoShowCoreIntro({ ...eligible, onHomeRoute: false })).toBe(false);
    expect(shouldAutoShowCoreIntro({ ...eligible, guidanceReady: false })).toBe(false);
    expect(shouldAutoShowCoreIntro({ ...eligible, acknowledged: true })).toBe(false);
    expect(shouldAutoShowCoreIntro({ ...eligible, alreadyHandled: true })).toBe(false);
  });
});
