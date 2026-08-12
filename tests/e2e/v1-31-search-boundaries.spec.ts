import { expect, test } from "@playwright/test";

async function openAddPlaces(page: import("@playwright/test").Page) {
  await page.goto("/exempel");
  const trigger = page.getByRole("button", { name: /lägg till.*ställ/i }).first();
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

    await expect(dialog.getByText("Värmdö kommun", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Skärgårdsvägen 8", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText(
        "Områden söks inom sin gräns. Avståndet gäller bara adresser och andra punktval.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("combobox", { name: "Avstånd runt adresser och platser" }),
    ).toBeVisible();

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

  test("boundary-only döljer punktavståndet", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const dialog = await openAddPlaces(page);

    const removeAddress = dialog.getByRole("button", {
      name: "Ta bort Skärgårdsvägen 8, Gustavsberg från sökningen",
    });
    await expect(removeAddress).toBeVisible();
    await removeAddress.click();

    await expect(dialog.getByText("Söker inom områdesgränser")).toBeVisible();
    await expect(
      dialog.getByRole("combobox", { name: "Avstånd runt adresser och platser" }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Visa information om Stavsnäs Sjökrog", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText(/km från Värmdö kommun/i)).toHaveCount(0);
  });
});
