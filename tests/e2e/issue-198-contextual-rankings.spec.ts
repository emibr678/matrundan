import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    metrics.scrollWidth,
    `${context}: dokumentet får inte få horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
  expect(
    metrics.bodyScrollWidth,
    `${context}: body får inte få horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth);
}

test("topplistan kombinerar Passar för, tillfälle och hämtmat", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  const leaderboard = page.getByTestId("occasion-leaderboard");
  await leaderboard.getByRole("button", { name: "Visa topp 3", exact: true }).click();

  await expect(leaderboard.getByText("Passar för", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Tillfälle", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Hämtmat", { exact: true })).toBeVisible();
  await expect(
    leaderboard.getByText(
      "Något att dricka saknar betyg och visas därför inte här.",
      { exact: true },
    ),
  ).toBeVisible();

  await leaderboard.getByRole("button", { name: "Visa topplista för Lunch" }).click();
  await expect(leaderboard.getByText("Rundans Bistro", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Falafelfredag", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Kardemummaköket", { exact: true })).toHaveCount(0);
  await expect(leaderboard).toContainText("1 besök");
  await expectNoHorizontalOverflow(page, "Lunchfilter");

  await leaderboard.getByRole("button", { name: "Visa topplista för Snabbt och enkelt" }).click();
  await expect(leaderboard.getByText("Falafelfredag", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Rundans Bistro", { exact: true })).toHaveCount(0);

  await leaderboard.getByRole("button", { name: "Visa endast hämtmat i topplistan" }).click();
  await expect(leaderboard.getByText("Falafelfredag", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Lunch + Snabbt och enkelt + hämtmat");

  await leaderboard.getByRole("button", { name: "Visa topplista för Middag" }).click();
  await expect(
    leaderboard.getByText("Inga betyg matchar de valda filtren ännu.", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Tom kombination");

  await leaderboard.getByRole("button", { name: "Visa topplista för alla betyg" }).click();
  await leaderboard.getByRole("button", { name: "Visa endast hämtmat i topplistan" }).click();
  await leaderboard.getByRole("button", { name: "Visa topplista för alla tillfällen" }).click();
  await leaderboard.getByRole("button", { name: "Visa topplista för Fika" }).click();
  await expect(leaderboard.getByText("Kardemummaköket", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Rundans Bistro", { exact: true })).toHaveCount(0);
});
