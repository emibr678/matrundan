import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
}

async function expectTransparentBrandMark(
  scope: import("@playwright/test").Locator,
  variant: "lockup" | "mark",
) {
  const brand = scope.locator(`[data-matrundan-brand='${variant}']`).first();
  await expect(brand).toBeVisible();

  const mark = brand.locator("img[data-matrundan-brand-mark='image']").first();
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute("src", "/brand/matrundan-mark.png");
  await expect(brand.locator("svg.lucide-utensils")).toHaveCount(0);

  const styles = await mark.evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return {
      background: computed.backgroundColor,
      loaded: (node as HTMLImageElement).naturalWidth > 0,
    };
  });
  expect(styles.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(styles.loaded).toBe(true);
}

test("landningen använder central brand och gemensam Om-dialog", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expectTransparentBrandMark(page.locator("header"), "lockup");
  await expect(page.getByRole("link", { name: "Matrundan" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Om Matrundan" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Om Matrundan" })).toBeVisible();
  await expectTransparentBrandMark(dialog, "mark");
});

test("exempelgruppen använder samma brand utan att ersätta gruppemojin", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  await expectTransparentBrandMark(page.locator("header"), "lockup");

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
