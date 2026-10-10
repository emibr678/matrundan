import { expect, test } from "@playwright/test";

// Temporary development-only visual evidence. Remove after inspection.
test("capture focused and browse mobile UX for visual inspection", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 690 });
  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  const input = dialog.getByRole("combobox", { name: "Sök matställen" });
  await expect(dialog).toHaveAttribute("data-search-shell", "browse");

  async function capture(name: string) {
    const shot = await page.screenshot({ type: "jpeg", quality: 48, animations: "disabled" });
    console.log("MATRUNDAN_VISUAL_CAPTURE:" + name + ":" + shot.toString("base64"));
  }

  await capture("browse-light");
  await input.fill("Päronträdets Trattoria");
  await expect(dialog).toHaveAttribute("data-search-shell", "focused");
  await expect(dialog.getByRole("listbox")).toBeVisible();
  await page.setViewportSize({ width: 360, height: 460 });
  await capture("focused-light");
  await page.setViewportSize({ width: 360, height: 690 });
  await dialog.getByRole("button", { name: "Ändra sökområden" }).click();
  await expect(dialog.getByPlaceholder("Sök kommun, ort, stadsdel eller adress")).toBeVisible();
  await capture("areas-light");
  await dialog.getByRole("button", { name: "Dölj sökområden" }).click();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await capture("browse-dark");
});
