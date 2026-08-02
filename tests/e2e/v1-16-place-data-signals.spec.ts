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

test("begränsad platsinformation förklaras utan closure-bekräftelser i demo", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await addDialog
    .getByRole("button", {
      name: "Visa information om Päronträdets Trattoria",
      exact: true,
    })
    .click();

  const resultDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(resultDialog.getByText("Begränsad platsinformation", { exact: true })).toBeVisible();
  await expect(
    resultDialog.getByText(
      "Webbplats och öppettider saknas i platsdatan. Det betyder inte att verksamheten har stängt, men uppgifterna bör kontrolleras före ett besök.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    resultDialog.getByRole("button", { name: "Verkar fortfarande öppet", exact: true }),
  ).toHaveCount(0);
  await expect(
    resultDialog.getByRole("button", { name: "Bekräfta permanent stängt", exact: true }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Begränsad platsinformation före tillägg");
});
