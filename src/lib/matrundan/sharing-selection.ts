import { visitMealLabel } from "./visit-context";

export interface PlaceShareTargetLike {
  groupId: string;
  placeExistsInGroup: boolean;
}

export interface OwnVisitForPlaceLike {
  visitId: string;
  visitedOn: string;
  mealType: string;
  alreadySharedToTarget: boolean;
}

const MONTH_NAMES = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
] as const;

export function defaultShareGroupIds(
  targets: PlaceShareTargetLike[],
  currentGroupId: string | null,
): string[] {
  return targets
    .filter((target) => target.groupId !== currentGroupId && target.placeExistsInGroup)
    .map((target) => target.groupId);
}

export function toggleAllSelection(allIds: string[], selectedIds: string[]): string[] {
  const uniqueIds = [...new Set(allIds)];
  const allSelected = uniqueIds.length > 0 && uniqueIds.every((id) => selectedIds.includes(id));
  return allSelected ? [] : uniqueIds;
}

export function availableOwnVisits<T extends OwnVisitForPlaceLike>(visits: T[]): T[] {
  return visits.filter((visit) => !visit.alreadySharedToTarget);
}

export function formatOwnVisitDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = MONTH_NAMES[month - 1];

  if (!monthName || day < 1 || day > 31) return value;
  return `${day} ${monthName} ${year}`;
}

export function formatMealType(value: string): string {
  return visitMealLabel(value);
}
