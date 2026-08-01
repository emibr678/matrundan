import { describe, expect, test } from "bun:test";
import {
  MAX_BULK_PLACE_COUNT,
  completedBulkExternalIds,
  remainingBulkSelections,
  successfulBulkPlaceCount,
  toProviderPlaceBatchInput,
  toggleBulkPlaceSelection,
  type BulkPlaceAddResult,
} from "./bulk-place-add";
import type { PlaceSuggestion } from "./places-provider";

function suggestion(id: string): PlaceSuggestion {
  return {
    externalId: id,
    provider: "geoapify",
    name: `Ställe ${id}`,
    category: "restaurang",
    cuisines: ["Italienskt"],
    address: `${id} Testgatan`,
    city: "Stockholm",
    lat: 59.3,
    lng: 18.1,
    raw: JSON.stringify({ id }),
  };
}

describe("masstillägg av matställen", () => {
  test("markerar och avmarkerar samma sökträff", () => {
    const item = suggestion("one");
    expect(toggleBulkPlaceSelection([], item)).toEqual([item]);
    expect(toggleBulkPlaceSelection([item], item)).toEqual([]);
  });

  test("släpper inte in fler än sökresultatets tekniska maxgräns", () => {
    const selected = Array.from({ length: MAX_BULK_PLACE_COUNT }, (_, index) =>
      suggestion(String(index)),
    );
    expect(toggleBulkPlaceSelection(selected, suggestion("extra"))).toBe(selected);
  });

  test("skickar normaliserad provideridentitet och tolkar rådata", () => {
    expect(toProviderPlaceBatchInput(suggestion("abc"))).toEqual({
      externalId: "abc",
      provider: "geoapify",
      providerPlaceId: "abc",
      name: "Ställe abc",
      category: "restaurang",
      cuisines: ["Italienskt"],
      address: "abc Testgatan",
      area: undefined,
      city: "Stockholm",
      lat: 59.3,
      lng: 18.1,
      raw: { id: "abc" },
    });
  });

  test("behåller bara misslyckade val för återförsök", () => {
    const result: BulkPlaceAddResult = {
      items: [
        { externalId: "one", name: "Ett", status: "added", placeId: "p1" },
        { externalId: "two", name: "Två", status: "failed", message: "Nätverk" },
        { externalId: "three", name: "Tre", status: "existing", placeId: "p3" },
      ],
      added: 1,
      restored: 0,
      existing: 1,
      failed: 1,
    };

    expect(remainingBulkSelections([suggestion("one"), suggestion("two"), suggestion("three")], result))
      .toEqual([suggestion("two")]);
    expect(completedBulkExternalIds(result)).toEqual(["one", "three"]);
    expect(successfulBulkPlaceCount(result)).toBe(1);
  });
});
