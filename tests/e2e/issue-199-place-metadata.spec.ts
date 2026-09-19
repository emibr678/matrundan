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

test("platsmetadata använder enkla begrepp och återgår tyst till ställets typ", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p2?demo=1");

  await expect(page.getByText("Café", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Kök och inriktning", { exact: true })).toBeVisible();
  await expect(page.getByText("Passar för", { exact: true })).toBeVisible();
  await expect(page.getByText(/grundtyp|grunduppgift/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Detaljsida med platsmetadata");

  await page.getByRole("button", { name: "Ändra gruppens uppgifter om stället" }).click();
  let dialog = page.getByRole("dialog", { name: "Ändra gruppens uppgifter om stället" });
  await expect(dialog.getByText("Typ av ställe", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("combobox").first()).toContainText("Café");
  await expect(dialog.getByText(/grundtyp|grunduppgift/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Redigering av platsmetadata");

  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Restaurang", exact: true }).click();
  await dialog.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(page.getByText("Restaurang", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Ändra gruppens uppgifter om stället" }).click();
  dialog = page.getByRole("dialog", { name: "Ändra gruppens uppgifter om stället" });
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Café", exact: true }).click();
  await dialog.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(page.getByText("Café", { exact: true }).first()).toBeVisible();

  const savedCategoryOverride = await page.evaluate(() => {
    const raw = window.localStorage.getItem("matrundan.state.v1");
    if (!raw) return undefined;
    const state = JSON.parse(raw) as {
      places?: Array<{ id: string; categoryOverride?: string | null }>;
    };
    return state.places?.find((place) => place.id === "p2")?.categoryOverride;
  });
  expect(savedCategoryOverride).toBeNull();

  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Öppna filter och sortering" }).click();
  const filterSheet = page.getByRole("dialog", { name: "Filter & sortering" });
  await expect(filterSheet.getByText("Typ av ställe", { exact: true })).toBeVisible();
  await expect(filterSheet.getByRole("button", { name: "Vad betyder Passar för?" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Filter för platsmetadata");
});
