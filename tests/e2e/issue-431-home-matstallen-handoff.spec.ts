import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    metrics.scrollWidth,
    `${context}: sidan får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test("Hem lämnar samla-flödet till Matställen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await page.goto("/?demo=1");
  await expect(page.getByRole("button", { name: "Lägg till ställe", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bläddra listan", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Renodlat Hem");

  await page.goto("/matstallen?demo=1&add=place");
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(addDialog).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has("add")).toBe(false);
  await expectNoHorizontalOverflow(page, "Matställen med lägg-till-dialog");

  await page.keyboard.press("Escape");
  await expect(addDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/matstallen");
});
