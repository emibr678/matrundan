import { expect, test } from "@playwright/test";

async function openDemo(page: import("@playwright/test").Page) {
  await page.goto("/matstallen?demo=1");
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
}

test("flera sökområden läggs till i samma fält utan horisontell overflow på 360 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openDemo(page);

  const addPlace = page.getByRole("button", { name: /lägg till ställe/i }).first();
  await expect(addPlace).toBeVisible();
  await addPlace.click();

  await expect(page.getByText("Sökområden", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /annan plats/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /använd platsen/i })).toHaveCount(0);
  await expect(
    page.getByText("Ändringar här gäller bara den här sökningen.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Högst fem områden kan användas samtidigt. Ta bort ett för att välja ett annat."),
  ).toHaveCount(0);

  const areaInput = page.getByRole("textbox", { name: "Sökområden", exact: true });
  await expect(areaInput).toHaveAttribute("placeholder", "Sök ort, stadsdel eller adress");
  await areaInput.fill("Majorna, Göteborg");
  await areaInput.press("Enter");
  await expect(areaInput).toHaveValue("");
  await expect(page.getByRole("list", { name: "Valda sökområden" })).toContainText("Majorna");

  await areaInput.fill("Södermalm, Stockholm");
  await areaInput.press("Enter");
  await expect(areaInput).toHaveValue("");
  await expect(page.getByRole("list", { name: "Valda sökområden" })).toContainText("Södermalm");
  await expect(areaInput).toBeDisabled();
  await expect(areaInput).toHaveAttribute("placeholder", "Max 5 områden valda");

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
