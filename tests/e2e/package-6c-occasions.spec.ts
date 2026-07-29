import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    metrics.scrollWidth,
    `${context}: dokumentet får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test("sammanhang väljs aktivt och förklaras konsekvent på mobil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Öppna filter och sortering" }).click();
  const filterSheet = page.getByRole("dialog", { name: "Filter & sortering" });
  await expect(filterSheet.getByText("Passar för", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Vardag & häng", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Middag & upplevelse", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Trevlig middag", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Kategorifilter");
  await filterSheet.getByRole("button", { name: /Visa \d+/ }).click();

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await addDialog.getByRole("button", { name: "Lägg till manuellt" }).click();
  await addDialog.getByLabel("Namn").fill("Testköket");
  await addDialog.getByLabel("Adress").fill("Testgatan 1");

  const addButton = addDialog.getByRole("button", { name: "Lägg till", exact: true });
  await expect(addButton).toBeDisabled();
  await expect(addDialog.getByText("Välj minst ett sammanhang för att fortsätta.")).toBeVisible();
  await expect(addDialog.getByText("Vardag & häng", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("Middag & upplevelse", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("Trevlig middag", { exact: true })).toHaveCount(0);

  await addDialog.getByRole("button", { name: "Vad betyder Passar för?" }).click();
  const guide = page.getByText("Välj efter sammanhang", { exact: true }).locator("../..");
  await expect(guide).toContainText("inte hur bra det är");
  await expect(guide).toContainText("kvarterskrog");
  await expect(guide).toContainText("upplevelsen");
  await expectNoHorizontalOverflow(page, "Öppen kategoriförklaring");
  await page.keyboard.press("Escape");

  await addDialog.getByRole("button", { name: "Vardag & häng" }).click();
  await addDialog.getByRole("button", { name: "Middag & upplevelse" }).click();
  await expect(addButton).toBeEnabled();
  await expectNoHorizontalOverflow(page, "Manuellt tillägg med kategorier");
  await addButton.click();

  const placeLink = page.getByRole("link", { name: /Testköket/ });
  await expect(placeLink).toBeVisible();
  await placeLink.click();
  await expect(page.getByText("Vardag & häng", { exact: true })).toBeVisible();
  await expect(page.getByText("Middag & upplevelse", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vad betyder Passar för?" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Detaljsida med flera sammanhang");

  await page.getByRole("button", { name: "Hantera ställe" }).click();
  const adminDialog = page.getByRole("dialog", { name: "Hantera Testköket" });
  await expect(adminDialog.getByText("Vardag & häng", { exact: true })).toBeVisible();
  await expect(adminDialog.getByText("Middag & upplevelse", { exact: true })).toBeVisible();
  await expect(adminDialog.getByRole("button", { name: "Vad betyder Passar för?" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Administration med sammanhang");
});
