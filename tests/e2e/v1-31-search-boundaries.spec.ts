import { expect, test } from "@playwright/test";

async function openAddPlaces(page: import("@playwright/test").Page) {
  await page.goto("/exempel");
  await page.getByRole("link", { name: "Matställen", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Lägg till ställe", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("v1.31 sökområdesgränser", () => {
  test("kombinerar kommunboundary och adresspunkt på 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const dialog = await openAddPlaces(page);
    await expect(dialog).toBeFocused();
    await expect(dialog).toHaveCSS("outline-style", "none");
    await dialog.getByRole("button", { name: "Ändra sökområden" }).click();

    const addArea = dialog.getByRole("button", { name: "Lägg till sökområde" });
    await expect(addArea).toHaveCSS("min-height", "44px");
    await expect(dialog.getByText("Värmdö kommun", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Skärgårdsvägen 8", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Avstånd", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Runt Skärgårdsvägen 8")).toBeVisible();
    await expect(dialog.getByText("Vi söker också i hela Värmdö kommun.")).toBeVisible();
    const selectedAreas = dialog.getByRole("list", { name: "Valda sökområden" });
    await expect(selectedAreas.locator("svg.lucide-map")).toHaveCount(1);
    await expect(selectedAreas.locator("svg.lucide-map-pin")).toHaveCount(1);
    await expect(
      dialog.getByRole("combobox", { name: "Avstånd runt adresser och platser" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("group", { name: /Vi söker inom \d+ km från Skärgårdsvägen 8\./ }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Dölj sökområden" }).click();
    await dialog.getByRole("button", { name: "Karta" }).click();
    const map = dialog.getByRole("region", {
      name: "Karta över sökresultat och valda sökområden",
    });
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute("data-search-boundary-count", "1");
    await expect(map).toHaveAttribute("data-search-point-area-count", "1");
    await expect(map).toHaveAttribute("data-map-boundary-layer", "ready", { timeout: 15_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("visar ortsförslag utan teknisk gränsförklaring på 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const dialog = await openAddPlaces(page);
    await dialog.getByRole("button", { name: "Ändra sökområden" }).click();
    await dialog.getByRole("button", { name: "Lägg till sökområde" }).click();
    await dialog.locator("#search-area-query").fill("Stavsnäs");

    const suggestions = dialog.getByRole("listbox");
    await expect(suggestions.getByRole("option", { name: /Stavsnäs/ })).toBeVisible();
    await expect(suggestions).toContainText("Ort · Värmdö kommun");
    await expect(suggestions).not.toContainText("Om ortens gräns");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("boundary-only döljer punktavståndet", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const dialog = await openAddPlaces(page);

    const removeAddress = dialog.getByRole("button", {
      name: "Ta bort Skärgårdsvägen 8, Gustavsberg från sökningen",
    });
    await expect(removeAddress).toBeVisible();
    await removeAddress.click();

    await expect(dialog.getByText("Vi söker i hela Värmdö kommun.")).toBeVisible();
    await expect(
      dialog.getByRole("list", { name: "Valda sökområden" }).locator("svg.lucide-map-pin"),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("combobox", { name: "Avstånd runt adresser och platser" }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Visa information om Stavsnäs Sjökrog", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText(/km från Värmdö kommun/i)).toHaveCount(0);
  });
});
