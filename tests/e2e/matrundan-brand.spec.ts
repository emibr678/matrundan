import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
}

test("landningen använder central brand och gemensam Om-dialog", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const headerBrand = page.locator("header [data-matrundan-brand='lockup']").first();
  await expect(headerBrand).toBeVisible();
  await expect(headerBrand.locator("img")).toHaveAttribute("src", "/icons/matrundan-192.png");
  await expect(page.getByRole("link", { name: "Matrundan" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Om Matrundan" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Om Matrundan" })).toBeVisible();
  await expect(dialog.locator("[data-matrundan-brand='mark'] img")).toHaveAttribute(
    "src",
    "/icons/matrundan-192.png",
  );
});

test("exempelgruppen använder samma brand utan att ersätta gruppemojin", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  const headerBrand = page.locator("header [data-matrundan-brand='lockup']").first();
  await expect(headerBrand).toBeVisible();
  await expect(headerBrand.locator("img")).toHaveAttribute("src", "/icons/matrundan-192.png");

  const groupMenu = page.getByRole("button", { name: /^Profil och grupp:/ });
  await expect(groupMenu).toBeVisible();
  await expect(groupMenu).toContainText("🍝");
  await expectNoHorizontalOverflow(page);

  await groupMenu.click();
  await page.getByRole("menuitem", { name: "Om Matrundan" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Om Matrundan" }),
  ).toBeVisible();
});
