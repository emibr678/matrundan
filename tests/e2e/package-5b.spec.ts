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
  return dialog.getByRole("button", { name: `Granska ${name}`, exact: true }).locator("..");
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

async function selectForBulk(dialog: Locator, name: string) {
  await dialog.getByRole("checkbox", { name: `Välj ${name} för masstillägg`, exact: true }).click();
}

test("flera sökträffar markeras i lista och karta och läggs till i samma omgång", async ({
  page,
}) => {
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

  await selectForBulk(dialog, "Päronträdets Trattoria");
  await expect(dialog.getByText("1 ställe valt", { exact: true })).toBeVisible();
  await expect(suggestionRow(dialog, "Päronträdets Trattoria")).toHaveAttribute(
    "data-bulk-selected",
    "true",
  );

  const mapToggle = dialog.getByRole("button", { name: "Karta", exact: true });
  await mapToggle.click();
  await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator('[data-bulk-selected-count="1"]:visible')).toBeVisible();
  await expect(dialog.getByText("Deg & Dagg", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Markera", exact: true }).click();
  await expect(dialog.locator('[data-bulk-selected-count="2"]:visible')).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Avmarkera", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Valda sökträffar på kartan");

  await dialog.getByRole("button", { name: "Lägg till 2 ställen", exact: true }).click();
  await expect(
    dialog.getByText("2 ställen tillagda i den här omgången", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/ställen valda/)).toHaveCount(0);
  await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
  await expect(radius).toContainText("Inom 10 km");

  await dialog.getByRole("button", { name: "Lista", exact: true }).click();
  const existing = existingSection(dialog, initialExistingCount + 2);
  await expect(existing).toBeVisible();
  await expect(existing).toHaveAttribute("data-state", "closed");
  await existing.click();
  await expect(existing).toHaveAttribute("data-state", "open");
  await expect(
    dialog.getByRole("checkbox", {
      name: "Välj Päronträdets Trattoria för masstillägg",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(dialog.getByText("Päronträdets Trattoria", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Deg & Dagg", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Masstillägg och redan tillagda vid 360 px");

  await dialog.getByRole("button", { name: "Klar", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Lägg till matställe" });
  await reopened.getByRole("combobox").click();
  await page.getByRole("option", { name: "Inom 10 km" }).click();

  const reopenedExisting = existingSection(reopened, initialExistingCount + 2);
  await expect(reopenedExisting).toHaveAttribute("data-state", "closed");
  await reopenedExisting.click();
  await expect(reopenedExisting).toHaveAttribute("data-state", "open");
  await expect(reopened.getByText("Päronträdets Trattoria", { exact: true })).toBeVisible();
  await expect(reopened.getByText("Deg & Dagg", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redan tillagda sökträffar på 360 px");
});
