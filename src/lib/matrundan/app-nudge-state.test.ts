import { describe, expect, test } from "bun:test";
import {
  dismissNudge,
  FIRST_NUDGE_SNOOZE_MS,
  isNudgeHidden,
  muteNudge,
  nudgeSnoozeMs,
  REPEAT_NUDGE_SNOOZE_MS,
  shouldOfferPermanentNudgeDismissal,
} from "./app-nudge-state";

describe("app nudges", () => {
  test("snoozar första Inte nu i sju dagar", () => {
    const now = 1_000_000;
    const entry = dismissNudge(undefined, now);

    expect(entry.dismissCount).toBe(1);
    expect(nudgeSnoozeMs(entry)).toBe(FIRST_NUDGE_SNOOZE_MS);
    expect(isNudgeHidden(entry, now + FIRST_NUDGE_SNOOZE_MS - 1)).toBe(true);
    expect(isNudgeHidden(entry, now + FIRST_NUDGE_SNOOZE_MS)).toBe(false);
  });

  test("erbjuder aktivt opt-out från och med andra Inte nu", () => {
    const first = dismissNudge(undefined, 1_000_000);

    expect(shouldOfferPermanentNudgeDismissal(first)).toBe(true);

    const second = dismissNudge(first, 2_000_000);
    expect(second.dismissCount).toBe(2);
    expect(nudgeSnoozeMs(second)).toBe(REPEAT_NUDGE_SNOOZE_MS);
  });

  test("permanent avfärdning gäller bara nudgen tills användaren själv ändrar funktionen", () => {
    const muted = muteNudge({ dismissCount: 1 });

    expect(isNudgeHidden(muted, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(muted.done).toBeUndefined();
  });

  test("äldre sparad dismissal utan räknare får den nya korta snoozen", () => {
    const now = 5_000_000;
    const legacy = { dismissedAt: now };

    expect(nudgeSnoozeMs(legacy)).toBe(FIRST_NUDGE_SNOOZE_MS);
    expect(shouldOfferPermanentNudgeDismissal(legacy)).toBe(false);
  });
});
