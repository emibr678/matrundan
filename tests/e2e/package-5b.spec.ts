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

function existingSection(dialog: Locator, count: number) {
  return dialog.getByRole("button", {
    name: `Redan i gruppen (${count})`,
    exact: true,
  });
}

async function readExistingCount(dialog: Locator) {
  const trigger = dialog.getByRole("button", { name: /Redan i gruppen \(\d+\)/ }).first();
  await expect(trigger).toBeVisible();
  const match = (await trigger.innerText()).match(/\((\d+)\)/);
  if (!match) throw new Error("Kunde inte läsa antalet ställen som redan finns i gruppen.");
  return Number(match[1]);
}

async function confirmSuggestion(page: Page) {
  const confirmation = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Passar bäst för: Vardag & häng", exact: true })
    .click();
  await confirmation.getByRole("button", { name: "Lägg till i gruppen" }).click();
  await expect(confirmation).toBeHidden();
}

async function addSuggestion(page: Page, dialog: Locator, name: string) {
  const row = suggestionRow(dialog, name);
  await row.getByRole("button", { name: "Lägg till", exact: true }).click();
  await confirmSuggestion(page);
}

test("flera sökträffar kan läggas till utan att sökningen börjar om", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(dialog).toBeVisible();

  const radius = dialog.getByRole("combobox");
  await radius.click();
  await page.getByRole("option", { name: "Inom 10 km" }).click();
  await expect(radius).toContainText("Inom 10 km");
  await expect(suggestionRow(dialog, "Päronträdets Trattoria")).toBeVisible();
  const initialExistingCount = await readExistingCount(dialog);

  const mapToggle = dialog.getByRole("button", { name: "Karta", exact: true });
  await mapToggle.click();
  await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Lägg till", exact: true }).click();
  await confirmSuggestion(page);
  await expect(dialog).toBeVisible();
  await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
  await expect(radius).toContainText("Inom 10 km");
  await expect(
    dialog.getByText("1 ställe tillagt i den här omgången", { exact: true }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Lista", exact: true }).click();
  const afterMapAdd = existingSection(dialog, initialExistingCount + 1);
  await expect(afterMapAdd).toBeVisible();
  await expect(afterMapAdd).toHaveAttribute("data-state", "closed");

  await addSuggestion(page, dialog, "Päronträdets Trattoria");
  await expect(
    dialog.getByText("2 ställen tillagda i den här omgången", { exact: true }),
  ).toBeVisible();
  await expect(existingSection(dialog, initialExistingCount + 2)).toHaveAttribute(
    "data-state",
    "closed",
  );

  await addSuggestion(page, dialog, "Hagabackens Kafferum");
  await expect(
    dialog.getByText("3 ställen tillagda i den här omgången", { exact: true }),
  ).toBeVisible();
  await expect(existingSection(dialog, initialExistingCount + 3)).toHaveAttribute(
    "data-state",
    "closed",
  );
  await expect(radius).toContainText("Inom 10 km");
  await expectNoHorizontalOverflow(page, "Flera tillägg i samma sökomgång");

  await dialog.getByRole("button", { name: "Klar", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Lägg till matställe" });
  await reopened.getByRole("combobox").click();
  await page.getByRole("option", { name: "Inom 10 km" }).click();

  const reopenedExisting = existingSection(reopened, initialExistingCount + 3);
  await expect(reopenedExisting).toHaveAttribute("data-state", "closed");
  await reopenedExisting.click();
  await expect(reopenedExisting).toHaveAttribute("data-state", "open");
  await expect(
    suggestionRow(reopened, "Päronträdets Trattoria").getByRole("link", {
      name: "Öppna",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    suggestionRow(reopened, "Hagabackens Kafferum").getByRole("link", {
      name: "Öppna",
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redan tillagda sökträffar på 360 px");
});
