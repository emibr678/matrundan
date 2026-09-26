import { describe, expect, test } from "bun:test";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  onboardingStorageKey,
} from "./onboarding-state";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("onboarding state", () => {
  test("is versioned and scoped per milestone and user", () => {
    expect(onboardingStorageKey("product-intro", "user-a")).toBe(
      "matrundan.onboarding.product-intro.v1:user-a",
    );
    expect(onboardingStorageKey("occasion-guide", "user-a")).toBe(
      "matrundan.onboarding.occasion-guide.v1:user-a",
    );
  });

  test("marks a milestone without affecting another user or milestone", () => {
    const storage = memoryStorage();

    expect(hasSeenOnboarding("product-intro", "user-a", storage)).toBe(false);
    markOnboardingSeen("product-intro", "user-a", storage);

    expect(hasSeenOnboarding("product-intro", "user-a", storage)).toBe(true);
    expect(hasSeenOnboarding("product-intro", "user-b", storage)).toBe(false);
    expect(hasSeenOnboarding("occasion-guide", "user-a", storage)).toBe(false);
  });

  test("does not require storage or a user id", () => {
    expect(hasSeenOnboarding("product-intro", null, null)).toBe(false);
    expect(() => markOnboardingSeen("product-intro", null, null)).not.toThrow();
  });
});
