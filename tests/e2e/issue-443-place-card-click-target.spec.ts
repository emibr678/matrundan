import { expect, test } from "@playwright/test";

test("hela ställeskortet öppnar stället medan favorit är en separat handling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await page.goto("/matstallen?demo=1");

  const search = page.getByRole("textbox", { name: "Sök bland gruppens ställen" });
  await search.fill("Smakhallen");

  const openPlace = page.getByRole("link", { name: "Smakhallen", exact: true });
  await expect(openPlace).toBeVisible();

  const card = openPlace.locator("..");
  const [linkBox, cardBox] = await Promise.all([openPlace.boundingBox(), card.boundingBox()]);
  expect(linkBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(Math.abs(linkBox!.width - cardBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(linkBox!.height - cardBox!.height)).toBeLessThanOrEqual(2);

  const favorite = card.getByRole("button", { name: "Markera som favorit", exact: true });
  await expect(favorite).toBeVisible();
  await favorite.click();

  await expect(page).toHaveURL(/\/matstallen\?demo=1$/);
  await expect(card.getByRole("button", { name: "Ta bort favorit", exact: true })).toBeVisible();

  await openPlace.click({
    position: {
      x: 24,
      y: Math.max(8, linkBox!.height - 16),
    },
  });

  await expect(page).toHaveURL(/\/matstallen\/p8(?:\?demo=1)?$/);
  await expect(page.getByRole("heading", { name: "Smakhallen" })).toBeVisible();
});
