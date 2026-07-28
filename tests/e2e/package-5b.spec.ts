import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(60_000);

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

function suggestionRow(dialog: Locator, name: string) {
  return dialog.getByRole("button", { name: new RegExp(name) }).locator("..");
}

async function addSuggestion(page: Page, dialog: Locator, name: string) {
  const row = suggestionRow(dialog, name);
  await row.getByRole("button", { name: "Lägg till", exact: true }).click();

  const confirmation = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Lägg till i gruppen" }).click();
  await expect(confirmation).toBeHidden();
  await expect(row.getByRole("button", { name: "Tillagd", exact: true })).toBeVisible();
}

test("flera sökträffar kan läggas till utan att sökningen börjar om", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(dialog).toBeVisible();

  const radius = dialog.getByRole("combobox");
  await radius.click();
  await page.getByRole("option", { name: "Inom 10 km" }).click();
  await expect(radius).toContainText("Inom 10 km");
  await expect(dialog.getByText("Päronträdets Trattoria", { exact: true })).toBeVisible();

  await addSuggestion(page, dialog, "Päronträdets Trattoria");
  await expect(dialog).toBeVisible();
  await expect(radius).toContainText("Inom 10 km");
  await expect(dialog.getByText("1 ställe tillagt i den här omgången", { exact: true })).toBeVisible();

  await addSuggestion(page, dialog, "Hagabackens Kafferum");
  await expect(dialog.getByText("2 ställen tillagda i den här omgången", { exact: true })).toBeVisible();

  await addSuggestion(page, dialog, "Rislyktans Izakaya");
  await expect(dialog.getByText("3 ställen tillagda i den här omgången", { exact: true })).toBeVisible();
  await expect(radius).toContainText("Inom 10 km");
  await expectNoHorizontalOverflow(page, "Flera tillägg i samma sökomgång");

  await dialog.getByRole("button", { name: "Klar", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Lägg till matställe" });
  await reopened.getByRole("combobox").click();
  await page.getByRole("option", { name: "Inom 10 km" }).click();

  await expect(
    suggestionRow(reopened, "Päronträdets Trattoria").getByRole("button", {
      name: "Finns redan",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    suggestionRow(reopened, "Hagabackens Kafferum").getByRole("button", {
      name: "Finns redan",
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redan tillagda sökträffar på 360 px");
});
