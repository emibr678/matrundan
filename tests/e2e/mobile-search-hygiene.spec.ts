import { expect, test, type Locator, type Page } from "@playwright/test";

const PLACE_NAME = "Päronträdets Trattoria";

test.setTimeout(60_000);

async function expectInsideViewport(page: Page, locator: Locator, context: string) {
  await expect(locator, `${context}: vyn ska vara synlig`).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box, `${context}: vyn ska ha mätbar geometri`).not.toBeNull();
  expect(viewport, `${context}: viewport ska vara känd`).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x, `${context}: vänsterkant`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${context}: överkant`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${context}: högerkant`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${context}: nederkant`).toBeLessThanOrEqual(viewport.height + 1);
}

function reviewPlaceButton(scope: Locator | Page) {
  return scope.getByRole("button", { name: `Granska ${PLACE_NAME}`, exact: true });
}

async function openPlaceSearch(page: Page) {
  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const searchDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(searchDialog).toBeVisible();
  await expect(searchDialog.getByRole("button", { name: "Sök", exact: true })).toBeVisible();
  await expect(
    searchDialog.getByText(
      "Sök i gruppens vanliga områden eller lägg till fler platser för den här sökningen.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    searchDialog.getByText("Ändringar här gäller bara den här sökningen.", { exact: true }),
  ).toBeVisible();
  await expect(
    searchDialog.getByText(
      "Välj en träff så läggs den till nedan. Valen gäller bara den här sökningen.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await searchDialog.getByLabel("Sök", { exact: true }).fill(PLACE_NAME);
  await expect(reviewPlaceButton(searchDialog)).toBeVisible();
  return searchDialog;
}

test("mobilväljare och Passar för-hjälp stannar inom en kort 360 px-vy", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 520 });
  await openPlaceSearch(page);

  await reviewPlaceButton(page).click();
  const detailsDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(detailsDialog).toBeVisible();
  await expect(detailsDialog.getByText("Öppna i Google Maps", { exact: true })).toBeVisible();
  await expect(
    detailsDialog.getByText(
      "Google Maps söker efter namn, adress och vid behov kartposition. Kontrollera att rätt verksamhet har öppnats.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    detailsDialog.getByText("Valfritt – kan fyllas i efter ett besök.", { exact: true }),
  ).toBeVisible();

  const foodTagTrigger = detailsDialog.getByRole("combobox", {
    name: "Kök och inriktning (valfritt)",
  });
  await expect(foodTagTrigger).toContainText("2 valda");
  await foodTagTrigger.click();

  const foodTagDialog = page.getByTestId("food-tag-mobile-dialog");
  await expectInsideViewport(page, foodTagDialog, "Kök och inriktning vid normal mobilhöjd");

  const searchInput = foodTagDialog.getByPlaceholder("Sök kök eller inriktning…");
  await searchInput.focus();
  await page.setViewportSize({ width: 360, height: 420 });
  await expectInsideViewport(page, foodTagDialog, "Kök och inriktning efter minskad viewport");

  await searchInput.fill("japanskt");
  await searchInput.evaluate((element) => (element as HTMLInputElement).blur());
  await expect(foodTagDialog).toBeVisible();
  await foodTagDialog.getByRole("option", { name: "Japanskt" }).click();
  await foodTagDialog.getByRole("button", { name: "Klar", exact: true }).click();

  await page.setViewportSize({ width: 360, height: 520 });
  await expect(detailsDialog).toBeVisible();
  await expect(foodTagTrigger).toContainText("3 valda");

  await detailsDialog.getByRole("button", { name: "Vad betyder Passar för?" }).click();
  const guideDialog = page.getByRole("dialog", { name: "Så fungerar Passar för" });
  await expectInsideViewport(page, guideDialog, "Passar för-hjälpen");
  const guideScroll = await guideDialog.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(guideScroll.scrollHeight).toBeGreaterThan(guideScroll.clientHeight);
  await guideDialog.getByRole("button", { name: "Stäng", exact: true }).click();
  await expect(guideDialog).toBeHidden();
});

test("en dold demoträff försvinner ur sökningen och kan återställas i gruppinställningar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 520 });
  const searchDialog = await openPlaceSearch(page);

  await reviewPlaceButton(searchDialog).click();
  const detailsDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await detailsDialog
    .getByRole("button", { name: "Dölj från gruppens sökningar", exact: true })
    .click();

  await expect(detailsDialog).toBeHidden();
  await expect(reviewPlaceButton(searchDialog)).toHaveCount(0);
  await expect(
    searchDialog.getByText(
      "Inga matställen hittades. Prova större radie, andra områden eller lägg till manuellt.",
    ),
  ).toBeVisible();
  await expect(searchDialog.getByRole("button", { name: "Karta", exact: true })).toHaveCount(0);
  await searchDialog.getByRole("button", { name: "Klar", exact: true }).click();

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  const hiddenHeading = settings.getByRole("heading", { name: "Dolda sökträffar" });
  const hiddenSection = hiddenHeading.locator("..");
  await expect(hiddenSection.getByText(PLACE_NAME)).toBeVisible();
  await hiddenSection.getByRole("button", { name: "Återställ", exact: true }).click();
  await expect(hiddenSection.getByText(PLACE_NAME)).toHaveCount(0);

  await openPlaceSearch(page);
  await expect(reviewPlaceButton(page)).toBeVisible();
});
