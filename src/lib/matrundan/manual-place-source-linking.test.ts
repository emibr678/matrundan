import { describe, expect, test } from "bun:test";

import {
  findManualSourceLinkCandidate,
  hasActiveProviderSource,
} from "./manual-place-source-linking";
import type { Place } from "./types";
import type { PlaceSuggestion } from "./places-provider";

function manualPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "manual-1",
    name: "Testköket",
    category: "restaurang",
    cuisines: [],
    occasions: [],
    address: "Testgatan 1",
    city: "Stockholm",
    lat: 59.33,
    lng: 18.071,
    addedBy: "member-1",
    addedAt: "2026-08-01T12:00:00Z",
    origin: "manual",
    collectionStatus: "active",
    sources: [],
    ...overrides,
  };
}

function suggestion(overrides: Partial<PlaceSuggestion> = {}): PlaceSuggestion {
  return {
    externalId: "geo-1",
    provider: "geoapify",
    name: "Testköket",
    category: "restaurang",
    address: "Testgatan 1",
    city: "Stockholm",
    lat: 59.3302,
    lng: 18.0712,
    ...overrides,
  };
}

describe("manuell källmatchning", () => {
  test("föreslår exakt ett providerlöst manuellt ställe med samma namn och adress", () => {
    const match = findManualSourceLinkCandidate([manualPlace()], suggestion());
    expect(match?.place.id).toBe("manual-1");
    expect(match?.reason).toBe("same_name_and_address");
  });

  test("accepterar samma namn i närheten men inte ett avlägset ställe", () => {
    expect(
      findManualSourceLinkCandidate(
        [manualPlace({ address: "Okänd adress" })],
        suggestion({ address: "Annan gata 2" }),
      )?.reason,
    ).toBe("same_name_and_nearby");

    expect(
      findManualSourceLinkCandidate(
        [manualPlace({ address: "Okänd adress" })],
        suggestion({ address: "Annan gata 2", lat: 59.35, lng: 18.1 }),
      ),
    ).toBeNull();
  });

  test("föreslår aldrig automatiskt när flera manuella ställen passar", () => {
    const duplicate = manualPlace({ id: "manual-2" });
    expect(findManualSourceLinkCandidate([manualPlace(), duplicate], suggestion())).toBeNull();
  });

  test("ignorerar arkiverade, delade och redan källkopplade ställen", () => {
    expect(
      findManualSourceLinkCandidate([manualPlace({ collectionStatus: "archived" })], suggestion()),
    ).toBeNull();
    expect(
      findManualSourceLinkCandidate([manualPlace({ origin: "shared" })], suggestion()),
    ).toBeNull();
    expect(
      findManualSourceLinkCandidate(
        [
          manualPlace({
            sources: [
              {
                provider: "geoapify",
                providerPlaceId: "another-id",
                status: "active",
              },
            ],
          }),
        ],
        suggestion(),
      ),
    ).toBeNull();
  });

  test("känner igen en redan aktiv provideridentitet", () => {
    expect(
      hasActiveProviderSource(
        manualPlace({
          origin: "provider",
          sources: [{ provider: "geoapify", providerPlaceId: "geo-1", status: "active" }],
        }),
        suggestion(),
      ),
    ).toBe(true);
  });
});
