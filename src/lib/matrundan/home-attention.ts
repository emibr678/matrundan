export type HomeAttentionKind =
  "group-invitation" | "pending-review" | "personal-journey-intro" | "app-nudge";

/**
 * Hem visar högst en personlig uppmärksamhetsyta åt gången. Lågprioriterade
 * saker hålls tillbaka tills gruppinbjudningarnas state är känt.
 */
export function resolveHomeAttention(
  pendingInvitationsReady: boolean,
  pendingInvitationCount: number,
  pendingReviewCount: number,
  personalJourneyIntroEligible = false,
): HomeAttentionKind | null {
  if (!pendingInvitationsReady) return null;
  if (pendingInvitationCount > 0) return "group-invitation";
  if (pendingReviewCount > 0) return "pending-review";
  if (personalJourneyIntroEligible) return "personal-journey-intro";
  return "app-nudge";
}
