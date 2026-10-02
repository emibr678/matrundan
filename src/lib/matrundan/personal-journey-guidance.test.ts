import { describe, expect, test } from "bun:test";

import {
  guidanceIdentifier,
  shouldShowPersonalJourneyIntro,
  USER_GUIDANCE,
} from "./user-guidance";

describe("Min matresa-guidning", () => {
  test("har ett stabilt versionsstyrt guidance-id", () => {
    const identifier = guidanceIdentifier(USER_GUIDANCE.personalJourneyIntro);
    expect(identifier).toBe("personal-journey-intro@1");
  });

  test("visas först när flera aktiva grupper gör den relevant", () => {
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
    expect(shouldShowPersonalJourneyIntro({ ...eligible, acknowledged: true })).toBe(false);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, productTourActive: true })).toBe(false);
    expect(shouldShowPersonalJourneyIntro({ ...eligible, isLive: false })).toBe(false);

    const withoutCoreIntro = { ...eligible, coreIntroAcknowledged: false };
    expect(shouldShowPersonalJourneyIntro(withoutCoreIntro)).toBe(false);
  });
});
