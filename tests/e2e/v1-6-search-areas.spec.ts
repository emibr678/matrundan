import { expect, test } from "@playwright/test";

async function openDemo(page: import("@playwright/test").Page) {
  await page.goto("/matstallen?demo=1");
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
}

test("flera sökområden radbryts utan horisontell overflow på 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openDemo(page);

  const addPlace = page.getByRole("button", { name: /lägg till ställe/i }).first();
  await expect(addPlace).toBeVisible();
  await addPlace.click();

  await expect(page.getByText("Sökområden", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /annan plats/i })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("redan tillagda ställen ligger i en stängd egen sektion", async ({ page }) => {
  await openDemo(page);
  await page
    .getByRole("button", { name: /lägg till ställe/i })
    .first()
    .click();

  const existing = page.getByRole("button", { name: /redan i gruppen \(/i });
  await expect(existing).toBeVisible();
  await expect(existing).toHaveAttribute("data-state", "closed");
  await existing.click();
  await expect(existing).toHaveAttribute("data-state", "open");
});
