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

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(metrics.documentScrollWidth, `${context}: dokument`).toBeLessThanOrEqual(
    metrics.documentClientWidth,
  );
  expect(metrics.bodyScrollWidth, `${context}: body`).toBeLessThanOrEqual(
    metrics.bodyClientWidth,
  );
}

function placeSuggestionButton(scope: Locator | Page) {
  return scope.getByRole("button", { name: `Visa information om ${PLACE_NAME}`, exact: true });
}

async function resetPlaceData(page: Page) {
  await page.evaluate(() => {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        key?.startsWith("matrundan.place-data-reports.") ||
        key?.startsWith("matrundan.hidden-place-suggestions.")
      ) {
        window.localStorage.removeItem(key);
      }
    }
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("matrundan.hidden-place-suggestions.")) {
        window.sessionStorage.removeItem(key);
      }
    }
  });
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
  await expect(placeSuggestionButton(searchDialog)).toBeVisible();
  return searchDialog;
}

test("mobilväljare och Passar för-hjälp stannar inom en kort 360 px-vy", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 520 });
  await openPlaceSearch(page);

  await placeSuggestionButton(page).click();
  const detailsDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(detailsDialog).toBeVisible();
  await expect(detailsDialog.getByRole("link", { name: `Öppna ${PLACE_NAME} i Google Maps` })).toBeVisible();
  await expect(detailsDialog.getByRole("button", { name: "Rapportera felaktig träff" })).toBeVisible();
  await expect(
    detailsDialog.getByText("Valfritt – kan fyllas i efter ett besök.", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Sökträffens detaljdialog");

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

test("en felaktig demoträff kan rapporteras, döljas och granskas utan overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 620 });
  await page.goto("/matstallen?demo=1");
  await resetPlaceData(page);
  const searchDialog = await openPlaceSearch(page);

  await placeSuggestionButton(searchDialog).click();
  const detailsDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await detailsDialog.getByRole("button", { name: "Rapportera felaktig träff" }).click();

  const reportDialog = page.getByRole("dialog", { name: "Rapportera felaktig träff" });
  await expect(reportDialog.getByText(/granskas av gruppens admin/)).toBeVisible();
  await expect(reportDialog.getByLabel("Dölj även träffen för gruppen")).toBeChecked();
  await reportDialog
    .getByLabel("Vad har du sett?")
    .fill("Skylten visar att restaurangen har stängt permanent och lokalen står tom.");
  await expectNoHorizontalOverflow(page, "Rapport om sökträff");
  await reportDialog.getByRole("button", { name: "Skicka rapport" }).click();

  await expect(detailsDialog).toBeHidden();
  await expect(placeSuggestionButton(searchDialog)).toHaveCount(0);
  await searchDialog.getByRole("button", { name: "Klar", exact: true }).click();

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  const hiddenHeading = settings.getByRole("heading", { name: "Dolda sökträffar" });
  const hiddenSection = hiddenHeading.locator("..");
  await expect(hiddenSection.getByText(PLACE_NAME)).toBeVisible();
  await hiddenSection.getByRole("button", { name: `Öppna den dolda sökträffen ${PLACE_NAME}` }).click();

  const hiddenDialog = page.getByRole("dialog", { name: PLACE_NAME });
  await expect(hiddenDialog.getByText(/Dold för den här gruppen/)).toBeVisible();
  await expect(hiddenDialog.getByRole("link", { name: `Öppna ${PLACE_NAME} i Google Maps` })).toBeVisible();
  await expect(hiddenDialog.getByRole("button", { name: "Rapportera felaktig uppgift" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Dold sökträff");
  await hiddenDialog.getByRole("button", { name: "Stäng", exact: true }).click();

  const placeDataSection = settings.getByRole("region", { name: "Platsdata" });
  await expect(placeDataSection.getByText("1 att granska")).toBeVisible();
  await placeDataSection.getByText(PLACE_NAME, { exact: true }).click();
  await expect(placeDataSection.getByText("Sökträff", { exact: true })).toBeVisible();
  await expect(placeDataSection.getByText("Kan ha stängt permanent eller ersatts")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Sökträffsrapport i adminöversikten");

  const hiddenRow = hiddenSection.getByText(PLACE_NAME).locator("..");
  await hiddenRow.getByRole("button", { name: "Återställ", exact: true }).click();
  await expect(hiddenSection.getByText(PLACE_NAME)).toHaveCount(0);

  await openPlaceSearch(page);
  await expect(placeSuggestionButton(page)).toBeVisible();
});
