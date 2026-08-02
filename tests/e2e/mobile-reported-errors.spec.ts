import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "matrundan.place-data-reports.v2.g1";

function report(overrides: Record<string, unknown>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    groupId: "g1",
    targetKind: "place",
    placeId: "p1",
    provider: null,
    providerPlaceId: null,
    placeName: "Lilla Myntans Matrum",
    placeAddress: "Myntgränden 8",
    placeCity: "Göteborg",
    placeWebsite: "https://example.com",
    category: "wrong_name",
    description: "Namnet på kartan stämmer inte med skylten vid entrén.",
    status: "open",
    reporterId: "m2",
    reporterName: "Johan",
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

const REPORTS = [
  report({}),
  report({
    id: "22222222-2222-4222-8222-222222222222",
    placeId: "p2",
    placeName: "Kvarterets Kardemumma med ett ovanligt långt namn",
    placeAddress: "Kanelgången 4",
    category: "wrong_opening_hours",
    description: "Öppettiderna verkar ha ändrats och behöver kontrolleras.",
    status: "ready_for_osm",
    reviewedBy: "m1",
    reviewerName: "Emilia",
    reviewedAt: "2026-08-01T11:00:00.000Z",
  }),
  report({
    id: "33333333-3333-4333-8333-333333333333",
    placeId: "p3",
    placeName: "Månskärans Taquería",
    category: "closed_or_replaced",
    description: "Verksamheten verkar ha stängt permanent.",
    status: "ready_for_osm",
    osmSubmissionState: "published",
    osmPublicText: "Verksamheten verkar ha stängt permanent. Kontrollera gärna uppgiften på plats.",
    osmNoteId: "123456",
    osmNoteUrl: "https://www.openstreetmap.org/note/123456",
    osmNoteStatus: "open",
    osmNoteCreatedAt: "2026-08-02T09:00:00.000Z",
    osmNoteLastCheckedAt: "2026-08-02T09:05:00.000Z",
  }),
  report({
    id: "44444444-4444-4444-8444-444444444444",
    placeId: "p4",
    placeName: "Bryggans Bistro",
    category: "wrong_address",
    description: "Kartmarkören ligger på fel sida av kvarteret.",
    status: "ready_for_osm",
    osmSubmissionState: "published",
    osmPublicText: "Kartmarkören verkar ligga på fel sida av kvarteret.",
    osmNoteId: "123457",
    osmNoteUrl: "https://www.openstreetmap.org/note/123457",
    osmNoteStatus: "closed",
    osmNoteCreatedAt: "2026-08-01T09:00:00.000Z",
    osmNoteLastCheckedAt: "2026-08-02T08:00:00.000Z",
    osmNoteClosedAt: "2026-08-02T08:00:00.000Z",
  }),
  report({
    id: "55555555-5555-4555-8555-555555555555",
    placeId: "p5",
    placeName: "Hamnens Hörna",
    category: "duplicate",
    description: "Samma matställe finns redan registrerat på kartan.",
    status: "resolved",
    updatedAt: "2026-08-02T12:00:00.000Z",
    reviewedBy: "m1",
    reviewerName: "Emilia",
    reviewedAt: "2026-08-02T12:00:00.000Z",
  }),
];

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth, `${context}: sidan får inte ha horisontell overflow`).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, reports }) => localStorage.setItem(key, JSON.stringify(reports)),
    { key: STORAGE_KEY, reports: REPORTS },
  );
});

test("Rapporterade fel är överskådligt och stegstyrt", async ({ page }, testInfo) => {
  await page.goto("/rapporterade-fel?demo=1");

  await expect(page.getByRole("heading", { name: "Rapporterade fel", level: 1 })).toBeVisible();
  await expect(page.getByText("Granska uppgifter om matställen som gruppen har rapporterat som felaktiga.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Att granska 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Redo att skicka 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Skickade 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avslutade 1/ })).toBeVisible();
  await expect(page.getByText("Lilla Myntans Matrum")).toBeVisible();
  await expectNoHorizontalOverflow(page, "rapportlistan");

  await testInfo.attach("rapporterade-fel-lista", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.getByText("Lilla Myntans Matrum").click();
  const reviewSheet = page.getByRole("dialog");
  await expect(reviewSheet.getByRole("heading", { name: "Lilla Myntans Matrum" })).toBeVisible();
  await expect(reviewSheet.getByRole("button", { name: "Fortsätt till rättelseförslag" })).toBeVisible();
  await expect(reviewSheet.getByText("OpenStreetMap, en öppen karta", { exact: false })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "granskningspanelen");
  await page.keyboard.press("Escape");
  await expect(reviewSheet).toBeHidden();

  await page.getByRole("button", { name: /Redo att skicka 1/ }).click();
  await page.getByText("Kvarterets Kardemumma med ett ovanligt långt namn").click();
  const correctionSheet = page.getByRole("dialog");
  await expect(correctionSheet.getByRole("heading", { name: "Kvarterets Kardemumma med ett ovanligt långt namn" })).toBeVisible();
  await expect(correctionSheet.getByText("Hjälp till att rätta uppgiften på kartan")).toBeVisible();
  await expect(correctionSheet.getByText("OpenStreetMap, en öppen karta", { exact: false })).toBeVisible();
  await expect(correctionSheet.getByRole("button", { name: "Skicka rättelseförslag" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "panelen för rättelseförslag");

  await testInfo.attach("rapporterade-fel-rattelseforslag", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await correctionSheet.getByRole("button", { name: "Så fungerar det" }).click();
  await expect(page.getByRole("heading", { name: "Rätta uppgifter i OpenStreetMap" })).toBeVisible();
  await expect(page.getByText("En rättelse i OpenStreetMap ändrar inte informationen i Google Maps.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Rätta uppgifter i OpenStreetMap" })).toBeHidden();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Skickade 2/ }).click();
  await page.getByText("Månskärans Taquería").click();
  const sentSheet = page.getByRole("dialog");
  await expect(sentSheet.getByText("Väntar på granskning", { exact: true })).toBeVisible();
  await expect(sentSheet.getByText("Rättelseförslaget har skickats till OpenStreetMap och väntar på att granskas.")).toBeVisible();
  await expect(sentSheet.getByRole("link", { name: /Visa ärendet i OpenStreetMap/ })).toBeVisible();
  await expect(sentSheet.getByRole("button", { name: "Uppdatera status" })).toBeVisible();
  await expect(sentSheet.getByRole("button", { name: "Skicka rättelseförslag" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "panelen för skickat förslag");
});
