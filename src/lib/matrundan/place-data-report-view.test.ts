import { describe, expect, test } from "bun:test";

import type { PlaceDataReport } from "./place-data-reports";
import {
  chooseDefaultReportedErrorFilter,
  countReportsByFilter,
  filterAndSortPlaceDataReports,
  getPlaceDataReportView,
} from "./place-data-report-view";

function report(overrides: Partial<PlaceDataReport> = {}): PlaceDataReport {
  return {
    id: crypto.randomUUID(),
    groupId: "group-1",
    targetKind: "place",
    placeId: "place-1",
    provider: null,
    providerPlaceId: null,
    placeName: "Testköket",
    placeAddress: "Testgatan 1",
    placeCity: "Stockholm",
    placeWebsite: null,
    category: "wrong_name",
    description: "Namnet på skylten stämmer inte med uppgiften i kartan.",
    status: "open",
    reporterId: "member-1",
    reporterName: "Emilia",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    reviewedBy: null,
    reviewerName: null,
    reviewedAt: null,
    resolutionNote: null,
    sources: [],
    osmSubmissionState: "not_submitted",
    osmSubmissionErrorCode: null,
    osmPublicText: null,
    osmNoteId: null,
    osmNoteUrl: null,
    osmNoteStatus: null,
    osmNoteCreatedAt: null,
    osmNoteLastCheckedAt: null,
    osmNoteClosedAt: null,
    ...overrides,
  };
}

describe("presentation av rapporterade fel", () => {
  test("låter en publicerad rättelse ha företräde framför ready_for_osm", () => {
    const view = getPlaceDataReportView(
      report({
        status: "ready_for_osm",
        osmSubmissionState: "published",
        osmNoteStatus: "open",
        osmNoteId: "123",
        osmNoteUrl: "https://www.openstreetmap.org/note/123",
        osmNoteCreatedAt: "2026-08-02T10:00:00.000Z",
      }),
    );

    expect(view.state).toBe("sent_pending");
    expect(view.filter).toBe("sent");
    expect(view.label).toBe("Väntar på granskning");
  });

  test("skiljer intern granskning från OpenStreetMap-granskning", () => {
    expect(getPlaceDataReportView(report()).label).toBe("Att granska");
    expect(
      getPlaceDataReportView(
        report({
          osmSubmissionState: "published",
          osmNoteStatus: "closed",
          osmNoteCreatedAt: "2026-08-02T10:00:00.000Z",
        }),
      ).label,
    ).toBe("Granskad i OpenStreetMap");
  });

  test("placerar varje rapport i ett entydigt filter", () => {
    const reports = [
      report(),
      report({ status: "ready_for_osm" }),
      report({ osmSubmissionState: "failed", status: "ready_for_osm" }),
      report({ osmSubmissionState: "published", osmNoteStatus: "open" }),
      report({ status: "resolved" }),
      report({ status: "dismissed" }),
    ];

    expect(countReportsByFilter(reports)).toEqual({ review: 1, ready: 2, sent: 1, closed: 2 });
  });

  test("väljer första relevanta standardfilter", () => {
    expect(chooseDefaultReportedErrorFilter([report({ status: "resolved" })])).toBe("closed");
    expect(
      chooseDefaultReportedErrorFilter([
        report({ status: "ready_for_osm" }),
        report({ osmSubmissionState: "published", osmNoteStatus: "open" }),
      ]),
    ).toBe("ready");
  });

  test("filtrerar på namn och sorterar arbetsköer äldst först", () => {
    const older = report({
      id: "11111111-1111-4111-8111-111111111111",
      placeName: "Äldre bistro",
      createdAt: "2026-07-01T10:00:00.000Z",
    });
    const newer = report({
      id: "22222222-2222-4222-8222-222222222222",
      placeName: "Nyare café",
      createdAt: "2026-08-01T10:00:00.000Z",
    });

    expect(
      filterAndSortPlaceDataReports([newer, older], "review", "").map((item) => item.id),
    ).toEqual([older.id, newer.id]);
    expect(filterAndSortPlaceDataReports([newer, older], "review", "bistro")).toEqual([older]);
  });
});
