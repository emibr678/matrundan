export type HomeAttentionKind = "group-invitation" | "pending-review" | "app-nudge";

/**
 * Hem visar högst en personlig uppmärksamhetsyta åt gången. Domänflödena
 * behåller sina egna kontrakt; denna funktion bestämmer bara presentationsordning.
 */
export function resolveHomeAttention(
  pendingInvitationCount: number,
  pendingReviewCount: number,
): HomeAttentionKind {
  if (pendingInvitationCount > 0) return "group-invitation";
  if (pendingReviewCount > 0) return "pending-review";
  return "app-nudge";
}
