import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 360, height: 800 } });

test("en annan deltagares besöksfoto visas utan möjlighet att ersätta det", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p2?visit=v1");

  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Kardemummaköket" })).toBeVisible();
  await expect(visitDialog.getByAltText("Foto från besöket")).toBeVisible();
  await expect(
    visitDialog.getByText("Fotot kan bara bytas av personen som lade upp det.", { exact: false }),
  ).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Välj foto" })).toHaveCount(0);
  await expect(visitDialog.getByRole("button", { name: "Ta bort foto" })).toBeVisible();

  const overflow = await visitDialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
