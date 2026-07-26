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

test("Matställen och sökdialogen fungerar vid 360 px", async ({ page }) => {
  await page.goto("/matstallen?demo=1");

  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Matställen i listvy");

  await page.getByRole("button", { name: "Karta", exact: true }).first().click();
  await expect(page.getByRole("region", { name: /Karta med \d+ av \d+ matställen/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Matställen i kartvy");

  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Lägg till matställe" })).toBeVisible();
  await expect(dialog.getByText("Fiktiv demodata för utveckling.")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Lägg till-dialog i listvy");

  await dialog.getByRole("button", { name: "Karta", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Karta över sökresultat" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Lägg till-dialog i kartvy");
});
