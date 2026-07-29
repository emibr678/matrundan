import type { Role, Visit } from "./types";

export function canDeleteOriginalVisit(
  visit: Pick<Visit, "createdBy" | "linkType">,
  currentUserId: string,
  role: Role | null | undefined,
  groupArchived: boolean,
) {
  if (groupArchived || visit.linkType === "shared") return false;
  return visit.createdBy === currentUserId || role === "ägare" || role === "admin";
}
