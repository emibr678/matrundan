export type HomeAttentionKind = "group-invitation" | "pending-review" | "app-nudge";

/**
 * Hem visar högst en personlig uppmärksamhetsyta åt gången. Lågprioriterade
 * saker hålls tillbaka tills gruppinbjudningarnas state är känt.
 */
export function resolveHomeAttention(
  pendingInvitationsReady: boolean,
  pendingInvitationCount: number,
  pendingReviewCount: number,
): HomeAttentionKind | null {
  if (!pendingInvitationsReady) return null;
  if (pendingInvitationCount > 0) return "group-invitation";
  if (pendingReviewCount > 0) return "pending-review";
  return "app-nudge";
}
