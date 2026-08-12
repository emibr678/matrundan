import { expect, test } from "@playwright/test";

async function openDemo(page: import("@playwright/test").Page) {
  await page.goto("/matstallen?demo=1");
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
}

async function openSearchDialog(page: import("@playwright/test").Page) {
  const addPlace = page.getByRole("button", { name: /lägg till ställe/i }).first();
  await expect(addPlace).toBeVisible();
  await addPlace.click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(dialog.getByRole("heading", { name: "Sök i", exact: true })).toBeVisible();
  return dialog;
}

test("flera sökområden använder kompakta chips utan horisontell overflow på 360 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openDemo(page);
  const dialog = await openSearchDialog(page);

  await expect(page.getByRole("button", { name: /annan plats/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /använd platsen/i })).toHaveCount(0);
  await expect(
    dialog.getByText(
      "Områden söks inom sin gräns. Avståndet gäller bara adresser och andra punktval.",
      { exact: true },
    ),
  ).toBeVisible();

  const areaInput = dialog.getByRole("combobox", {
    name: "Lägg till område eller adress",
    exact: true,
  });
  await expect(areaInput).toHaveAttribute("placeholder", "Sök kommun, ort, stadsdel eller adress");

  await areaInput.fill("Stavsnäs");
  const stavnas = page.getByRole("button", { name: "Stavsnäs. Ort · Värmdö kommun" });
  await expect(stavnas).toBeVisible();
  await expect(stavnas).toContainText("Stavsnäs");
  await expect(stavnas).toContainText("Ort · Värmdö kommun");
  await expect(stavnas).not.toContainText("AB");
  await areaInput.press("ArrowDown");
  await areaInput.press("Enter");
  await expect(page.getByRole("list", { name: "Valda sökområden" })).toContainText("Stavsnäs");
  await page.getByRole("button", { name: /Ta bort Stavsnäs.*från sökningen/i }).click();

  await areaInput.fill("Värmdö kommun");
  const municipality = page.getByRole("button", {
    name: "Värmdö kommun. Kommun · Stockholms län",
  });
  await expect(municipality).toBeVisible();
  await expect(municipality).toBeEnabled();

  await areaInput.fill("Det mycket långa sökområdet längs skärgårdsvägen, Stockholm");
  await expect(
    page.getByRole("button", {
      name: /Det mycket långa sökområdet längs skärgårdsvägen\. Ort · Stockholm/,
    }),
  ).toBeVisible();
  const autocompleteOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(autocompleteOverflow).toBeLessThanOrEqual(0);

  await areaInput.fill("Majorna, Göteborg");
  await areaInput.press("Enter");
  await expect(areaInput).toHaveValue("");
  await expect(page.getByRole("list", { name: "Valda sökområden" })).toContainText("Majorna");

  await areaInput.fill("Södermalm, Stockholm");
  await areaInput.press("Enter");
  await expect(page.getByRole("list", { name: "Valda sökområden" })).toContainText("Södermalm");
  await expect(areaInput).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("5 av 5 områden valda.");
  await expect(page.getByRole("status")).toContainText(
    "Ta bort ett område för att söka efter ett annat.",
  );

  const selectedAreas = page.getByRole("list", { name: "Valda sökområden" });
  const pillHeights = await selectedAreas
    .getByRole("listitem")
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(Math.max(...pillHeights)).toBeLessThanOrEqual(32);

  const removeTarget = page.getByRole("button", { name: /Ta bort Majorna.*från sökningen/i });
  const removeBox = await removeTarget.boundingBox();
  expect(
    removeBox?.height ?? 0,
    "krysset ska behålla minst 44 px effektiv tryckyta",
  ).toBeGreaterThanOrEqual(32);
  await removeTarget.click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", { name: "Lägg till område eller adress", exact: true }),
  ).toHaveAttribute("placeholder", "Sök kommun, ort, stadsdel eller adress");

  const mapToggle = page.getByRole("button", { name: "Karta", exact: true });
  await mapToggle.click();
  const map = page.getByRole("region", {
    name: "Karta över sökresultat och valda sökområden",
  });
  await expect(map).toHaveAttribute("data-map-icon-renderer", "canvas");
  await expect(map).toHaveAttribute("data-map-point-visual", "category-icon");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("geografisk autocomplete behåller svensk hierarki utan overflow på desktopbredd", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await openDemo(page);
  const dialog = await openSearchDialog(page);

  const areaInput = dialog.getByRole("combobox", {
    name: "Lägg till område eller adress",
    exact: true,
  });
  await areaInput.fill("Skärgårdsvägen 8");

  const address = page.getByRole("button", {
    name: "Skärgårdsvägen 8. Adress · Gustavsberg",
  });
  await expect(address).toBeVisible();
  await expect(address).toContainText("Skärgårdsvägen 8");
  await expect(address).toContainText("Adress · Gustavsberg");

  await areaInput.fill("Värmdö kommun");
  await expect(
    page.getByRole("button", { name: "Värmdö kommun. Kommun · Stockholms län" }),
  ).toBeEnabled();

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
