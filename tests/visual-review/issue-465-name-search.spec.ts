import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("namnsökning för mobilt och desktop i exempelgruppen (#465)", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  const input = dialog.getByRole("combobox", { name: "Sök matställen", exact: true });
  await expect(input).toBeVisible();
  await expect(dialog).toHaveCSS("outline-style", "none");

  const dir = path.join("visual-review", testInfo.project.name);
  await mkdir(dir, { recursive: true });
  await input.fill("Päronträdets");
  await expect(dialog.getByRole("listbox", { name: "Förslag på kök, typer och matställen" })).toBeVisible();
  await expect(
    dialog.getByRole("listbox").getByText("Päronträdets Trattoria", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(dir, "issue-465-focused-search.png"), fullPage: false });

  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await page.setViewportSize({ width: 360, height: 420 });
    await expect(dialog.getByRole("listbox")).toBeVisible();
    await page.screenshot({ path: path.join(dir, "issue-465-small-keyboard.png"), fullPage: false });
    await page.setViewportSize({ width: 360, height: 800 });
    await dialog.getByRole("button", { name: "Tillbaka till resultaten" }).click();
  } else {
    await input.evaluate((element) => (element as HTMLInputElement).blur());
  }

  await expect(dialog).toBeVisible();
  await page.screenshot({ path: path.join(dir, "issue-465-browse.png"), fullPage: false });

  if (viewport && viewport.width < 1024) {
    await dialog.getByRole("button", { name: "Ändra sökområden" }).click();
    await expect(dialog.getByRole("button", { name: "Lägg till sökområde" })).toBeVisible();
    await expect(dialog.getByText("Avstånd", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Sök matställen" })).toBeVisible();
    await page.screenshot({
      path: path.join(dir, "issue-465-area-filter-expanded.png"),
      fullPage: false,
    });
    await dialog.getByRole("button", { name: "Lägg till sökområde" }).click();
    await expect(
      dialog.getByRole("combobox", { name: "Lägg till område eller adress" }),
    ).toBeFocused();
    await page.screenshot({
      path: path.join(dir, "issue-465-area-location-input.png"),
      fullPage: false,
    });
    await dialog.getByRole("combobox", { name: "Sök matställen" }).focus();
    await expect(dialog.locator("#mobile-search-area-editor")).toBeHidden();
  }

  const metrics = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(metrics.doc).toBeLessThanOrEqual(0);
  expect(metrics.body).toBeLessThanOrEqual(0);
});
