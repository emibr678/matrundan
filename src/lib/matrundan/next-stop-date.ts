import type { NextStopDateProposal, NextStopDateResponseValue, Role } from "./types";

export const NEXT_STOP_DATE_RESPONSE_LABEL: Record<NextStopDateResponseValue, string> = {
  fits: "Passar",
  not_fits: "Passar inte",
  unsure: "Osäker",
};

export function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultNextStopDateValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return localDateValue(date);
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
