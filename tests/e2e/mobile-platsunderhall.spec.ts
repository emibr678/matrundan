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
  expect(metrics.bodyScrollWidth, `${context}: body får inte ha horisontell overflow`).toBeLessThanOrEqual(
    metrics.bodyClientWidth,
  );
}

test("Platsunderhåll fungerar i demo utan horisontell overflow", async ({ page }) => {
  await page.goto("/platsunderhall?demo=1");

  await expect(page.getByRole("heading", { name: "Platsunderhåll" })).toBeVisible();
  await expect(page.getByText("Fiktiv demodata för utveckling")).toBeVisible();
  await expect(page.getByRole("button", { name: /Att kontrollera/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /OSM-åtgärd/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avslutade/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – att kontrollera");

  await page.getByRole("button", { name: "Sök extern matchning" }).click();
  await expect(page.getByText("Bistro Malma Kvarn & Krog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Länka som samma ställe" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – extern matchning");

  await page.getByRole("button", { name: /OSM-åtgärd/ }).click();
  await expect(page.getByRole("heading", { name: "Bryggans Bageri" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Öppna OpenStreetMap" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kopiera platsinfo" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – OSM-åtgärd");

  await page.getByRole("button", { name: /Avslutade/ }).click();
  await expect(page.getByText("Kajkanten")).toBeVisible();
  await expect(page.getByText("Hamnboden")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – avslutade");
});
