import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 360, height: 800 } });

test("redigerar äldre helhetsbetyg utan modellbyte", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p1?visit=v8");

  const visitDialog = page.getByRole("dialog").first();
  const reviewSection = visitDialog.getByLabel("Gängets omdömen");
  const historicalReview = reviewSection.locator('[data-review-id="review-v8-alex"]');

  await expect(historicalReview.locator("[data-review-rating]")).toContainText("4,0");
  await historicalReview.getByRole("button", { name: "Redigera omdöme" }).click();

  const editDialog = page.getByRole("dialog", { name: "Redigera ditt omdöme" });
  await expect(editDialog.getByText("4,0 / 5", { exact: true })).toBeVisible();
  await expect(editDialog.getByRole("group", { name: "Detaljbetyg" })).toHaveCount(0);
  await expect(editDialog.getByRole("button", { name: "Lägg till Atmosfär" })).toHaveCount(0);

  await editDialog.getByRole("button", { name: "Betyg: 3 av 5" }).click();
  await expect(editDialog.getByText("3,0 / 5", { exact: true })).toBeVisible();

  const overflow = await editDialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await editDialog.getByRole("button", { name: "Spara omdöme" }).click();

  await expect(page.getByText("Ditt omdöme är uppdaterat.")).toBeVisible();
  await expect(historicalReview.locator("[data-review-rating]")).toContainText("3,0");

  await historicalReview.getByRole("button", { name: "Redigera omdöme" }).click();
  const reopened = page.getByRole("dialog", { name: "Redigera ditt omdöme" });
  await expect(reopened.getByText("3,0 / 5", { exact: true })).toBeVisible();
  await expect(reopened.getByRole("group", { name: "Detaljbetyg" })).toHaveCount(0);
  await expect(reopened.getByRole("button", { name: "Lägg till Atmosfär" })).toHaveCount(0);
});
