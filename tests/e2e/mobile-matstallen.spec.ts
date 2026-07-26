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

  const startX = box.x + box.width * 0.25;
  const startY = box.y + box.height * 0.45;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 70, startY + 30, { steps: 8 });
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
  const markers = mapRegion.locator(".matrundan-place-marker");

  await expect(mapRegion).toHaveAttribute("data-clustering-disabled-at", "17");

  for (let index = 0; index < 5; index += 1) {
    const before = Number(await mapRegion.getAttribute("data-map-zoom"));
    await zoomOut.click();
    await expect
      .poll(async () => Number(await mapRegion.getAttribute("data-map-zoom")))
      .toBeLessThan(before);
  }

  await expect.poll(async () => clusters.count()).toBeGreaterThan(0);
  const initialClusterCount = await clusters.count();
  const clusterZoom = Number(await mapRegion.getAttribute("data-map-zoom"));
  await clusters.first().click({ force: true });
  await expect
    .poll(async () => Number(await mapRegion.getAttribute("data-map-zoom")))
    .toBeGreaterThan(clusterZoom);
  await expect.poll(async () => clusters.count()).toBeLessThan(initialClusterCount);
  await expect.poll(async () => markers.count()).toBeGreaterThan(0);
}

test("Matställen och sökdialogen fungerar vid 360 px", async ({ page }) => {
  let mapTileRequests = 0;
  await page.route("https://maps.geoapify.com/**", async (route) => {
    mapTileRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
        "base64",
      ),
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
  await expect(placesMap.getByText("Laddar kartan…")).toHaveCount(0);
  await expect.poll(() => mapTileRequests).toBeGreaterThan(0);
  const firstTile = placesMap.locator("img.leaflet-tile").first();
  await expect(firstTile).toBeVisible();
  await expect.poll(() => firstTile.getAttribute("crossorigin")).toBeNull();
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
  await expect(searchMap).toHaveAttribute("data-map-tile-status", "ready");
  await expect(searchMap.getByText("Laddar kartan…")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Lägg till-dialog i kartvy");
});
