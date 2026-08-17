import type { NextStopDateProposal, NextStopDateResponseValue, Role } from "./types";

const STOCKHOLM_CALENDAR_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalenderdag i Matrundans planeringstidzon, YYYY-MM-DD. */
export function localDateValue(date: Date): string {
  const parts = STOCKHOLM_CALENDAR_FORMATTER.formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function defaultNextStopDateValue(): string {
  const today = localDateValue(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function normalizeNextStopTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    throw new Error("Tiden måste anges som timmar och minuter.");
  }
  return trimmed;
}

export function isPastDateValue(value: string): boolean {
  return value < localDateValue(new Date());
}

export function formatNextStopDate(date: string, time?: string | null): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const dateLabel = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsed);
  const sentenceCaseLabel = dateLabel.charAt(0).toLocaleUpperCase("sv-SE") + dateLabel.slice(1);
  return time ? `${sentenceCaseLabel} kl. ${time.slice(0, 5)}` : sentenceCaseLabel;
}

export function canManageNextStopDateProposal(
  proposal: NextStopDateProposal,
  currentUserId: string,
  role: Role | undefined,
): boolean {
  return proposal.createdBy === currentUserId || role === "ägare" || role === "admin";
}

export function countNextStopDateResponses(proposal: NextStopDateProposal) {
  return proposal.responses.reduce(
    (counts, item) => {
      counts[item.response] += 1;
      return counts;
    },
    { fits: 0, not_fits: 0, unsure: 0 } satisfies Record<NextStopDateResponseValue, number>,
  );
}
