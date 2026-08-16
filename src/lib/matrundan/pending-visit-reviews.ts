import type { Visit } from "./types";
import { getVisitReviewSummary } from "./visit-reviews";

export const PENDING_REVIEW_ATTENTION_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function ownParticipationStatus(visit: Visit, currentUserId: string) {
  return (
    visit.currentUserParticipationStatus ??
    (visit.participantIds.includes(currentUserId) ? "participant" : "none")
  );
}

function localCalendarDayNumber(value: string): number | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) / DAY_MS,
  );
}

function nowCalendarDayNumber(now: Date): number | null {
  if (Number.isNaN(now.getTime())) return null;
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/**
 * Kanonisk klienthärledning för att aktuell användare behöver komplettera ett
 * redan synligt besök med sitt eget omdöme. Registreraren särbehandlas inte:
 * serverinvarianten för nya besök gör registreraren till faktisk deltagare med
 * ett eget review redan i registreringsflödet.
 */
export function isVisitReviewPending(visit: Visit, currentUserId: string): boolean {
  if (ownParticipationStatus(visit, currentUserId) !== "participant") return false;
  return !getVisitReviewSummary(visit, currentUserId).ownReview;
}

/**
 * Den framträdande in-app-signalen är avsiktligt begränsad till aktuella besök.
 * Äldre besök kan fortfarande vara kanoniskt pending och kompletteras när de
 * öppnas, men de skapar ingen retroaktiv påminnelsebacklog.
 */
export function isVisitReviewInsideAttentionWindow(
  visit: Visit,
  now: Date,
  attentionDays = PENDING_REVIEW_ATTENTION_DAYS,
): boolean {
  const today = nowCalendarDayNumber(now);
  const visitDay = localCalendarDayNumber(visit.date);
  if (today == null || visitDay == null) return false;

  const ageDays = today - visitDay;
  return ageDays >= 0 && ageDays <= attentionDays;
}

/**
 * Returnerar framträdande pending-besök för den redan serverfiltrerade aktiva
 * gruppstaten. Samma kanoniska visit-id dedupliceras defensivt och nyast visas
 * först.
 */
export function getAttentionPendingVisitReviews(
  visits: Visit[],
  currentUserId: string,
  now = new Date(),
): Visit[] {
  const byVisitId = new Map<string, Visit>();

  for (const visit of visits) {
    if (!isVisitReviewPending(visit, currentUserId)) continue;
    if (!isVisitReviewInsideAttentionWindow(visit, now)) continue;
    if (!byVisitId.has(visit.id)) byVisitId.set(visit.id, visit);
  }

  return [...byVisitId.values()].sort((left, right) => {
    const leftTime = Date.parse(left.date);
    const rightTime = Date.parse(right.date);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return rightTime - leftTime;
    return right.date.localeCompare(left.date);
  });
}
