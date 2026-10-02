import {
  loadPersonalJourneyVisits,
  type PersonalJourneyVisit,
  type PersonalJourneyVisitCursor,
} from "./personal-journey";
import {
  attentionWindowStartDate,
  isVisitDateInsideAttentionWindow,
} from "./pending-visit-reviews";

type AttentionVisitPage = {
  items: PersonalJourneyVisit[];
  nextCursor: PersonalJourneyVisitCursor | null;
};

type AttentionVisitPageLoader = (input: {
  participatedOnly: boolean;
  cursor: PersonalJourneyVisitCursor | null;
  limit: number;
}) => Promise<AttentionVisitPage>;

/**
 * Härleder vilka aktiva, skrivbara grupper som har en konkret personlig handling
 * från den serverfiltrerade kanoniska besökslistan. Samma visit kan markera flera
 * grupprader men Set-semantiken gör signalen binär per grupp.
 */
export function getPersonalJourneyAttentionGroupIds(
  visits: PersonalJourneyVisit[],
  now = new Date(),
): Set<string> {
  const groupIds = new Set<string>();

  for (const visit of visits) {
    if (!visit.participated || !visit.reviewPending) continue;
    if (!isVisitDateInsideAttentionWindow(visit.visitedOn, now)) continue;

    for (const group of visit.groups) {
      if (group.isArchived || !group.isWritable) continue;
      groupIds.add(group.groupId);
    }
  }

  return groupIds;
}

/**
 * Läser serverfiltrerade deltagna besök i 50-raderssidor och slutar så snart
 * sorteringen passerat 45-dagarsfönstret. Det undviker både overview-listans
 * avsiktliga femradersgräns och en klientbyggd union av separata gruppstates.
 */
export async function loadPersonalJourneyAttentionGroupIds(
  now = new Date(),
  loadPage: AttentionVisitPageLoader = loadPersonalJourneyVisits,
): Promise<string[]> {
  const groupIds = new Set<string>();
  const windowStart = attentionWindowStartDate(now);
  let cursor: PersonalJourneyVisitCursor | null = null;

  do {
    const page = await loadPage({ participatedOnly: true, cursor, limit: 50 });

    for (const groupId of getPersonalJourneyAttentionGroupIds(page.items, now)) {
      groupIds.add(groupId);
    }

    const lastVisitedOn = page.items.at(-1)?.visitedOn.slice(0, 10) ?? null;
    if (!page.nextCursor || !lastVisitedOn || (windowStart && lastVisitedOn < windowStart)) {
      break;
    }

    cursor = page.nextCursor;
  } while (cursor);

  return [...groupIds];
}
