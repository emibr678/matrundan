import { expect, test } from "@playwright/test";

const PLACE_NAME = "Päronträdets Trattoria";

async function openSearchResult(page: import("@playwright/test").Page) {
  const searchDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await searchDialog.getByLabel("Sök", { exact: true }).fill(PLACE_NAME);
  const result = searchDialog.getByRole("button", {
    name: `Visa information om ${PLACE_NAME}`,
    exact: true,
  });
  await expect(result).toBeVisible();
  await searchDialog.evaluate((element) => {
    element.scrollTop = Math.min(160, element.scrollHeight - element.clientHeight);
  });
  const scrollTop = await searchDialog.evaluate((element) => element.scrollTop);
  await result.click();
  return { searchDialog, scrollTop };
}

test("kryss och Tillbaka återgår till samma sökning med ett aktivt dialoglager", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();

  const { searchDialog, scrollTop } = await openSearchResult(page);
  let resultDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(resultDialog).toBeVisible();
  await expect(searchDialog).toBeHidden();
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(1);
  await resultDialog.getByRole("button", { name: "Close", exact: true }).click();

  await expect(searchDialog).toBeVisible();
  await expect(searchDialog.getByLabel("Sök", { exact: true })).toHaveValue(PLACE_NAME);
  expect(await searchDialog.evaluate((element) => element.scrollTop)).toBe(scrollTop);

  await searchDialog
    .getByRole("button", { name: `Visa information om ${PLACE_NAME}`, exact: true })
    .click();
  resultDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(resultDialog).toBeVisible();
  await expect(searchDialog).toBeHidden();
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(1);
  await resultDialog.getByRole("button", { name: "Tillbaka", exact: true }).click();

  await expect(searchDialog).toBeVisible();
  await expect(searchDialog.getByLabel("Sök", { exact: true })).toHaveValue(PLACE_NAME);
  expect(await searchDialog.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});
