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

async function applyMissingFilters(page: Page) {
  await page.getByRole("button", { name: "Öppna filter och sortering" }).click();
  const filterSheet = page.getByRole("dialog", { name: "Filter & sortering" });
  const missing = filterSheet.getByRole("group", { name: "Filtrera på saknade uppgifter" });
  await missing.getByRole("button", { name: "Kök/inriktning", exact: true }).click();
  await missing.getByRole("button", { name: "Passar för", exact: true }).click();
  await filterSheet.getByRole("button", { name: /Visa \d+/ }).click();
}

test("ställen med saknade uppgifter kan filtreras fram och kompletteras", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await addDialog.getByRole("button", { name: "Lägg till manuellt" }).click();
  await addDialog.getByLabel("Namn").fill("Ofullständiga Hörnet");
  await addDialog.getByLabel("Adress").fill("Kompletteringsgatan 10");
  await addDialog.getByRole("button", { name: "Lägg till", exact: true }).click();

  await applyMissingFilters(page);
  const placeLink = page.getByRole("link", { name: /Ofullständiga Hörnet/ });
  await expect(placeLink).toBeVisible();
  await expectNoHorizontalOverflow(page, "Filter för saknade uppgifter");
  await placeLink.click();

  await page.getByRole("button", { name: "Hantera gruppens uppgifter om stället" }).click();
  const editDialog = page.getByRole("dialog", { name: "Redigera gruppens uppgifter" });
  await editDialog.getByRole("combobox", { name: "Kök och inriktning" }).click();
  const foodDialog = page.getByRole("dialog", { name: "Kök och inriktning" });
  await foodDialog.getByRole("option", { name: "Japanskt" }).click();
  await foodDialog.getByRole("button", { name: "Klar" }).click();
  await editDialog.getByRole("button", { name: "Passar för: Avslappnat", exact: true }).click();
  await editDialog.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(editDialog).toBeHidden();

  await page.getByRole("button", { name: "Gå tillbaka till matställen", exact: true }).click();
  await applyMissingFilters(page);
  await expect(page.getByRole("link", { name: /Ofullständiga Hörnet/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Kompletterat ställe lämnar underhållsfiltret");
});
