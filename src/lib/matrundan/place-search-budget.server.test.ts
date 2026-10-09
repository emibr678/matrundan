import { describe, expect, test } from "bun:test";
import {
  budgetProviderRequest,
  estimatedGeoapifyCredits,
  withPlaceSearchBudget,
} from "./place-search-budget.server";

describe("providerbudget per sökomgång", () => {
  test("delad gräns gäller även parallella och misslyckade anrop", async () => {
    let launched = 0;
    let concurrent = 0;
    let peak = 0;
    const result = await withPlaceSearchBudget({ requests: 5, credits: 40 }, async () => {
      const settled = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) =>
          budgetProviderRequest(1, async () => {
            launched += 1;
            concurrent += 1;
            peak = Math.max(peak, concurrent);
            await Promise.resolve();
            concurrent -= 1;
            if (i === 1) throw new Error("provider failure");
            return i;
          }),
        ),
      );
      return { settled };
    });
    expect(launched).toBe(5);
    expect(peak).toBeLessThanOrEqual(2);
    expect(result.budgetUsage).toEqual({ requests: 5, reservedCredits: 5, limited: true });
    expect(result.settled.filter((s) => s.status === "rejected")).toHaveLength(8);
  });

  test("kreditreservationen stoppar före anrop även om anrop finns kvar", async () => {
    let launched = 0;
    const result = await withPlaceSearchBudget({ requests: 25, credits: 5 }, async () => {
      const settled = await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          budgetProviderRequest(4, async () => {
            launched += 1;
          }),
        ),
      );
      return { settled };
    });
    expect(launched).toBe(1);
    expect(result.budgetUsage.reservedCredits).toBe(4);
    expect(result.budgetUsage.limited).toBe(true);
  });

  test("reserverar konservativt för större pages och geometri", () => {
    expect(estimatedGeoapifyCredits(new URL("https://api.geoapify.com/v2/places?limit=20"))).toBe(1);
    expect(estimatedGeoapifyCredits(new URL("https://api.geoapify.com/v2/places?limit=50"))).toBe(4);
    expect(
      estimatedGeoapifyCredits(
        new URL("https://api.geoapify.com/v2/place-details?features=details,details.full_geometry"),
      ),
    ).toBe(4);
  });
});
