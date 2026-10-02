import type { PersonalJourneyOverview } from "./personal-journey";
import { isVisitDateInsideAttentionWindow } from "./pending-visit-reviews";

/**
 * Härleder vilka aktiva, skrivbara grupper som just nu har en konkret personlig
 * handling för användaren. Gruppassociationerna kommer från Min matresas
 * serverfiltrerade cross-group-läsmodell; klienten läser aldrig gruppstater
 * separat för att bygga denna signal.
 */
export function getPersonalJourneyAttentionGroupIds(
  overview: PersonalJourneyOverview | undefined,
  now = new Date(),
): Set<string> {
  const groupIds = new Set<string>();
  if (!overview) return groupIds;

  for (const pending of overview.pendingReviews) {
    if (!isVisitDateInsideAttentionWindow(pending.visitedOn, now)) continue;

    for (const group of pending.groups) {
      if (group.isArchived || !group.isWritable) continue;
      groupIds.add(group.groupId);
    }
  }

  return groupIds;
}
