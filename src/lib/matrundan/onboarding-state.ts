export type OnboardingMilestone = "product-intro" | "occasion-guide";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const ONBOARDING_VERSION: Record<OnboardingMilestone, number> = {
  "product-intro": 1,
  "occasion-guide": 1,
};

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function onboardingStorageKey(
  milestone: OnboardingMilestone,
  userId: string,
): string {
  return `matrundan.onboarding.${milestone}.v${ONBOARDING_VERSION[milestone]}:${userId}`;
}

export function hasSeenOnboarding(
  milestone: OnboardingMilestone,
  userId: string | null | undefined,
  storage?: StorageLike | null,
): boolean {
  if (!userId) return false;
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    return target.getItem(onboardingStorageKey(milestone, userId)) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(
  milestone: OnboardingMilestone,
  userId: string | null | undefined,
  storage?: StorageLike | null,
): void {
  if (!userId) return;
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.setItem(onboardingStorageKey(milestone, userId), "1");
  } catch {
    // Onboarding får aldrig blockera appen om lokal lagring är otillgänglig.
  }
}
