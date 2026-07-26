import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    metrics.documentScrollWidth,
    `${context}: dokumentet får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.documentClientWidth);
  expect(
    metrics.bodyScrollWidth,
    `${context}: body får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth);
}

async function expectInteractiveMap(page: Page, mapRegion: ReturnType<Page["getByRole"]>) {
  await expect(mapRegion).toHaveAttribute("data-map-ready", "true");
  await expect(mapRegion).toHaveAttribute("data-map-renderer", "maplibre-vector");
  await expect(mapRegion).toHaveAttribute("data-map-tile-status", "ready");
  await expect(mapRegion.getByText("Laddar kartan…")).toHaveCount(0);

  const initialZoom = Number(await mapRegion.getAttribute("data-map-zoom"));
  await mapRegion.getByRole("button", { name: "Zooma in kartan" }).click();
  await expect
    .poll(async () => Number(await mapRegion.getAttribute("data-map-zoom")))
    .toBeGreaterThan(initialZoom);

  const initialLat = Number(await mapRegion.getAttribute("data-map-lat"));
  const initialLng = Number(await mapRegion.getAttribute("data-map-lng"));
  const mapSurface = mapRegion.getByLabel(
    "Interaktiv karta. Dra för att flytta och nyp för att zooma.",
  );
  await mapSurface.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  const box = await mapSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const dragPoint = await page.evaluate(
    ({ x, y, width, height }) => {
      const candidates = [
        [0.15, 0.2],
        [0.45, 0.2],
        [0.15, 0.55],
        [0.75, 0.55],
      ];
      for (const [xRatio, yRatio] of candidates) {
        const candidateX = x + width * xRatio;
        const candidateY = y + height * yRatio;
        const target = document.elementFromPoint(candidateX, candidateY);
        if (target?.classList.contains("maplibregl-canvas")) {
          return { x: candidateX, y: candidateY };
        }
      }
      return null;
    },
    box,
  );
  expect(dragPoint).not.toBeNull();
  if (!dragPoint) return;

  await page.mouse.move(dragPoint.x, dragPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragPoint.x + 70, dragPoint.y + 30, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const nextLat = Number(await mapRegion.getAttribute("data-map-lat"));
      const nextLng = Number(await mapRegion.getAttribute("data-map-lng"));
      return Math.abs(nextLat - initialLat) + Math.abs(nextLng - initialLng);
    })
    .toBeGreaterThan(0.00001);
}

async function expectMarkerClustering(mapRegion: ReturnType<Page["getByRole"]>) {
  const zoomOut = mapRegion.getByRole("button", { name: "Zooma ut kartan" });
  const clusters = mapRegion.locator(".matrundan-cluster-icon");
  const markersBefore = Number(await mapRegion.getAttribute("data-map-marker-count"));

  await expect(mapRegion).toHaveAttribute("data-clustering-disabled-at", "17");

  for (let index = 0; index < 5; index += 1) {
    const before = Number(await mapRegion.getAttribute("data-map-zoom"));
    await zoomOut.click();
    await expect
      .poll(async () => Number(await mapRegion.getAttribute("data-map-zoom")))
      .toBeLessThan(before);
  }

  await expect.poll(async () => clusters.count()).toBeGreaterThan(0);
  const initialMembers = Number(await clusters.first().getAttribute("data-cluster-count"));
  expect(initialMembers).toBeGreaterThan(1);

  const clusterZoom = Number(await mapRegion.getAttribute("data-map-zoom"));
  await clusters.first().click({ force: true });
  await expect
    .poll(async () => Number(await mapRegion.getAttribute("data-map-zoom")))
    .toBeGreaterThan(clusterZoom);
  await expect
    .poll(async () => Number(await mapRegion.getAttribute("data-map-largest-cluster")))
    .toBeLessThan(initialMembers);
  await expect
    .poll(async () => Number(await mapRegion.getAttribute("data-map-marker-count")))
    .toBeGreaterThan(markersBefore);
}

test("Matställen och sökdialogen fungerar vid 360 px", async ({ page }) => {
  let mapStyleRequests = 0;
  await page.route("https://maps.geoapify.com/v1/styles/**", async (route) => {
    mapStyleRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 8,
        name: "CI map style",
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eee9df" },
          },
        ],
      }),
      headers: { "cache-control": "no-store" },
    });
  });

  await page.goto("/matstallen?demo=1");

  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Matställen i listvy");

  await page.getByRole("button", { name: "Karta", exact: true }).first().click();
  const placesMap = page.getByRole("region", {
    name: /Karta med \d+ av \d+ matställen/,
  });
  await expect(placesMap).toBeVisible();
  await expect.poll(() => mapStyleRequests).toBeGreaterThan(0);
  await expectInteractiveMap(page, placesMap);
  await expectMarkerClustering(placesMap);
  await expectNoHorizontalOverflow(page, "Matställen i kartvy");

  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Lägg till matställe" })).toBeVisible();
  await expect(dialog.getByText("Fiktiv demodata för utveckling.")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Lägg till-dialog i listvy");

  await dialog.getByRole("button", { name: "Karta", exact: true }).click();
  const searchMap = dialog.getByRole("region", { name: "Karta över sökresultat" });
  await expect(searchMap).toBeVisible();
  await expect(searchMap).toHaveAttribute("data-map-ready", "true");
  await expect(searchMap).toHaveAttribute("data-map-renderer", "maplibre-vector");
  await expect(searchMap).toHaveAttribute("data-map-tile-status", "ready");
  await expect(searchMap.getByText("Laddar kartan…")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Lägg till-dialog i kartvy");
});
