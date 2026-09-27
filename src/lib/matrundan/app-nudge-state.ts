export const FIRST_NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const REPEAT_NUDGE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export type NudgeKey = "push" | "install";

export type NudgeEntry = {
  dismissedAt?: number;
  dismissCount?: number;
  done?: boolean;
  muted?: boolean;
};

export type NudgeState = Partial<Record<NudgeKey, NudgeEntry>>;

function dismissCount(entry?: NudgeEntry): number {
  return Math.max(0, entry?.dismissCount ?? 0);
}

export function shouldOfferPermanentNudgeDismissal(
  entry?: NudgeEntry,
): boolean {
  return dismissCount(entry) >= 1;
}

export function nudgeSnoozeMs(entry?: NudgeEntry): number {
  return dismissCount(entry) >= 2
    ? REPEAT_NUDGE_SNOOZE_MS
    : FIRST_NUDGE_SNOOZE_MS;
}

export function isNudgeHidden(
  entry: NudgeEntry | undefined,
  now = Date.now(),
): boolean {
  if (!entry) return false;
  if (entry.done || entry.muted) return true;
  if (!entry.dismissedAt) return false;
  return now - entry.dismissedAt < nudgeSnoozeMs(entry);
}

export function dismissNudge(
  entry: NudgeEntry | undefined,
  now = Date.now(),
): NudgeEntry {
  return {
    ...entry,
    dismissedAt: now,
    dismissCount: dismissCount(entry) + 1,
  };
}

export function muteNudge(entry: NudgeEntry | undefined): NudgeEntry {
  return {
    ...entry,
    muted: true,
  };
}
