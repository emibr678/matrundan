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

test("topplistan kombinerar flervalsfilter för Passar för, tillfälle och hämtmat", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  const leaderboard = page.getByTestId("occasion-leaderboard");
  await leaderboard.getByRole("button", { name: "Visa topp 3", exact: true }).click();

  await expect(leaderboard.getByText("Passar för", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Tillfälle", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Alla", { exact: true })).toHaveCount(0);
  await expect(leaderboard.getByText("Alla tillfällen", { exact: true })).toHaveCount(0);
  await expect(leaderboard.getByRole("button", { name: "Filtrera topplistan på hämtmat" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Ofiltrerad topplista");

  const lunch = leaderboard.getByRole("button", { name: "Filtrera topplistan på Lunch" });
  const dinner = leaderboard.getByRole("button", { name: "Filtrera topplistan på Middag" });
  await lunch.click();
  await expect(lunch).toHaveAttribute("aria-pressed", "true");
  await expect(leaderboard.getByText("Solsidans Sopplunch", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Kvarterets Kardemumma", { exact: true })).toHaveCount(0);

  await dinner.click();
  await expect(dinner).toHaveAttribute("aria-pressed", "true");
  await expect(leaderboard.getByText("Solsidans Sopplunch", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Månskärans Taquería", { exact: true })).toBeVisible();

  const quick = leaderboard.getByRole("button", {
    name: "Filtrera topplistan på Snabbt och enkelt",
  });
  const relaxed = leaderboard.getByRole("button", {
    name: "Filtrera topplistan på Avslappnat",
  });
  await quick.click();
  await relaxed.click();
  await expect(quick).toHaveAttribute("aria-pressed", "true");
  await expect(relaxed).toHaveAttribute("aria-pressed", "true");
  await expect(leaderboard.getByText("Solsidans Sopplunch", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Månskärans Taquería", { exact: true })).toBeVisible();

  const takeaway = leaderboard.getByRole("button", { name: "Filtrera topplistan på hämtmat" });
  await takeaway.click();
  await expect(takeaway).toHaveAttribute("aria-pressed", "true");
  await expect(leaderboard.getByText("Månskärans Taquería", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Solsidans Sopplunch", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Flervalsfilter + hämtmat");

  await lunch.click();
  await dinner.click();
  await quick.click();
  await relaxed.click();
  await takeaway.click();
  await expect(lunch).toHaveAttribute("aria-pressed", "false");
  await expect(dinner).toHaveAttribute("aria-pressed", "false");
  await expect(takeaway).toHaveAttribute("aria-pressed", "false");
  await expect(leaderboard.getByText("Kvarterets Kardemumma", { exact: true })).toBeVisible();
});
