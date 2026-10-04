import { expect, test } from "@playwright/test";

test("Issue #427 – signup visar bara verifierat lösenordskrav på mobil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "Fortsätt med e-post" }).click();
  await expect(page.getByRole("heading", { name: "Logga in med e-post" })).toBeVisible();

  await page.getByRole("button", { name: "Skapa nytt konto" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByRole("heading", { name: "Skapa konto med e-post" })).toBeVisible();
  await expect(dialog.getByText("Minst 8 tecken.", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/kända läckor/i)).toHaveCount(0);

  const hasHorizontalOverflow = await dialog.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
