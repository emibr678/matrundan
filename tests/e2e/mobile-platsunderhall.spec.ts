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

test("Platsunderhåll samlar rapporter och kandidater utan horisontell overflow", async ({ page }) => {
  await page.goto("/platsunderhall?demo=1");

  const openQueue = page.getByRole("button", { name: /^Att kontrollera \d+$/ });
  const reportedQueue = page.getByRole("button", { name: /^Rapporterade fel \d+$/ });
  const sourceQueue = page.getByRole("button", { name: /^Saknar extern källa \d+$/ });
  const osmQueue = page.getByRole("button", { name: /^OSM-åtgärd \d+$/ });
  const closedQueue = page.getByRole("button", { name: /^Klart \d+$/ });

  await expect(page.getByRole("heading", { name: "Platsunderhåll" })).toBeVisible();
  await expect(page.getByText("Fiktiv demodata för utveckling")).toBeVisible();
  await expect(openQueue).toBeVisible();
  await expect(reportedQueue).toBeVisible();
  await expect(sourceQueue).toBeVisible();
  await expect(osmQueue).toBeVisible();
  await expect(closedQueue).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kajkanten" })).toBeVisible();
  await expect(page.getByText("Fel webbplats", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Markera klart" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – rapporterat fel");

  await reportedQueue.click();
  await expect(page.getByRole("button", { name: /Skärgårdsfiket/ })).toBeVisible();
  await expect(page.getByText("Rapporterat fel", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – rapportfilter");

  await sourceQueue.click();
  await expect(page.getByRole("heading", { name: "Bistro Malma Kvarn" })).toBeVisible();
  await page.getByRole("button", { name: "Sök extern matchning" }).click();
  await expect(page.getByText("Bistro Malma Kvarn & Krog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Länka som samma ställe" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – extern matchning");

  await osmQueue.click();
  await expect(page.getByRole("heading", { name: "Bryggans Bageri" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Öppna OSM-not" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Öppna OpenStreetMap" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kopiera platsinfo" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – OSM-åtgärd");

  await closedQueue.click();
  await expect(page.getByRole("heading", { name: "Hamnkrogen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hamnboden/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – klart");
});
