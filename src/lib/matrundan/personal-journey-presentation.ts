import type { PersonalJourneyGroup } from "./personal-journey";

export function formatPersonalJourneyGroups(groups: PersonalJourneyGroup[]): string {
  if (groups.length === 0) return "Ingen tillgänglig grupp";
  if (groups.length === 1) return groups[0].groupName;
  return `${groups[0].groupName} +${groups.length - 1} ${groups.length === 2 ? "grupp" : "grupper"}`;
}
