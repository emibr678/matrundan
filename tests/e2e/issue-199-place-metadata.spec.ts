import { expect, test, type Page } from "@playwright/test";

import { resetDemoStateBeforeNavigation } from "./helpers/demo-state";

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

test("platsmetadata skiljer typ, kök och Passar för och kan återgå till grundtypen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p2?demo=1");

  await expect(page.getByText("Typ av ställe · Café", { exact: true })).toBeVisible();
  await expect(page.getByText("Kök och inriktning", { exact: true })).toBeVisible();
  await expect(page.getByText("Passar för", { exact: true })).toBeVisible();
  await expect(page.getByText("Typ av ställe är anpassad för Fredagsgänget.")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Detaljsida med gruppanpassad typ");

  await page.getByRole("button", { name: "Ändra gruppens uppgifter om stället" }).click();
  const dialog = page.getByRole("dialog", { name: "Ändra gruppens uppgifter om stället" });
  await expect(dialog.getByText("Typ av ställe", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Den valda typen visas bara i Fredagsgänget.")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redigering av platsmetadata");

  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Använd grundtypen: Restaurang" }).click();
  await expect(
    dialog.getByText("Gruppen använder samma typ som ställets grunduppgift."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Spara ändringar" }).click();

  await expect(page.getByText("Typ av ställe · Restaurang", { exact: true })).toBeVisible();
  await expect(page.getByText("Typ av ställe är anpassad för Fredagsgänget.")).toHaveCount(0);

  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Öppna filter och sortering" }).click();
  const filterSheet = page.getByRole("dialog", { name: "Filter & sortering" });
  await expect(filterSheet.getByText("Typ av ställe", { exact: true })).toBeVisible();
  await expect(
    filterSheet.getByRole("button", { name: "Vad betyder Passar för?" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Filter för platsmetadata");
});
