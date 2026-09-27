import { describe, expect, test } from "bun:test";
import {
  guidanceAcknowledgedForPresentation,
  guidanceIdentifier,
  guidanceRowsToIdentifiers,
  resolveGuidanceAcknowledgementAction,
  setGuidancePreview,
  shouldAutoShowCoreIntro,
  USER_GUIDANCE,
} from "./user-guidance";

describe("user guidance", () => {
  test("har stabila versionsstyrda identifierare", () => {
    expect(guidanceIdentifier(USER_GUIDANCE.coreIntro)).toBe("core-intro@1");
    expect(guidanceIdentifier(USER_GUIDANCE.occasionModel)).toBe(
      "occasion-model@1",
    );
    expect(guidanceIdentifier(USER_GUIDANCE.reviewContext)).toBe(
      "review-context@1",
    );
  });

  test("översätter databasrader utan gruppberoende", () => {
    expect(
      guidanceRowsToIdentifiers([
        { guidance_key: "core-intro", guidance_version: 1 },
        { guidance_key: "occasion-model", guidance_version: 1 },
        { guidance_key: "review-context", guidance_version: 1 },
      ]),
    ).toEqual(
      new Set(["core-intro@1", "occasion-model@1", "review-context@1"]),
    );
  });

  test("registret innehåller unika nyckel- och versionspar", () => {
    const identifiers = Object.values(USER_GUIDANCE).map(guidanceIdentifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  test("kan simulera osedd guide utan att ändra beständiga kvitton", () => {
    const acknowledged = new Set(["review-context@1"] as const);
    const previews = setGuidancePreview(
      new Set(),
      USER_GUIDANCE.reviewContext,
      true,
    );

    expect(
      guidanceAcknowledgedForPresentation(
        acknowledged,
        previews,
        USER_GUIDANCE.reviewContext,
      ),
    ).toBe(false);
    expect(acknowledged).toEqual(new Set(["review-context@1"]));
    expect(
      setGuidancePreview(previews, USER_GUIDANCE.reviewContext, false),
    ).toEqual(new Set());
  });

  test("kan simulera Passar för-modellen separat från omdömesguiden", () => {
    const previews = setGuidancePreview(
      new Set(),
      USER_GUIDANCE.occasionModel,
      true,
    );

    expect(previews).toEqual(new Set(["occasion-model@1"]));
    expect(
      guidanceAcknowledgedForPresentation(
        new Set(["occasion-model@1"]),
        previews,
        USER_GUIDANCE.occasionModel,
      ),
    ).toBe(false);
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
    expect(shouldAutoShowCoreIntro({ ...eligible, onHomeRoute: false })).toBe(
      false,
    );
    expect(shouldAutoShowCoreIntro({ ...eligible, guidanceReady: false })).toBe(
      false,
    );
    expect(shouldAutoShowCoreIntro({ ...eligible, acknowledged: true })).toBe(
      false,
    );
    expect(shouldAutoShowCoreIntro({ ...eligible, alreadyHandled: true })).toBe(
      false,
    );
  });
});
