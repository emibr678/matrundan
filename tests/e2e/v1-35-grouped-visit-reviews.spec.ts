import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `${context} ska inte ha horisontell overflow`).toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

async function expectNoLocatorOverflow(locator: Locator, context: string) {
  const overflow = await locator.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth, `${context} ska inte ha horisontell overflow`).toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

test.use({ viewport: { width: 360, height: 800 } });

test("exempelgruppen samlar 3+ deltagaromdömen och låter Alex komplettera samma besök", async ({
  page,
}) => {
  await page.goto("/exempel");
  await page.goto("/besok");

  await page.getByRole("button", { name: /Öppna besöket på Tacoateljén/ }).click();
  const visitDialog = page.getByRole("dialog").first();

  await expect(visitDialog.getByRole("heading", { name: "Gängets omdömen" })).toBeVisible();
  await expect(
    visitDialog.getByText("3 av 4 deltagare i gruppen har lämnat omdöme"),
  ).toBeVisible();
  await expect(visitDialog.getByText("Sam", { exact: true })).toBeVisible();
  await expect(visitDialog.getByText("Kim", { exact: true })).toBeVisible();
  await expect(visitDialog.getByText("Noor", { exact: true })).toBeVisible();
  await expect(
    visitDialog.getByText("Den här dolda kommentaren får inte visas i exempelgruppen."),
  ).toHaveCount(0);
  await expect(visitDialog.getByText("Kommentar från gänget", { exact: true })).toHaveCount(0);
  await expect(visitDialog.getByText("Din synlighet", { exact: true })).toHaveCount(0);
  await expect(
    visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" }),
  ).toHaveCount(1);
  await expectNoLocatorOverflow(visitDialog, "Tacoateljéns besöksdetalj");
  await expectNoHorizontalOverflow(page, "Tacoateljéns besöksdetalj på 360 px");

  await visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" }).click();
  const reviewDialog = page.getByRole("dialog").last();
  await expect(reviewDialog.getByRole("heading", { name: "Ditt omdöme" })).toBeVisible();
  await expect(reviewDialog.getByText(/samma gemensamma besök/)).toBeVisible();
  await reviewDialog.getByRole("button", { name: "Helhetsbetyg: 5 av 5" }).click();
  await reviewDialog.getByLabel("Kommentar (frivilligt)").fill("Mitt eget minne från kvällen.");
  await reviewDialog.getByRole("button", { name: "Spara omdöme" }).click();

  await expect(page.getByText("Ditt omdöme är tillagt.")).toBeVisible();
  await expect(
    visitDialog.getByText("4 av 4 deltagare i gruppen har lämnat omdöme"),
  ).toBeVisible();
  await expect(
    visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" }),
  ).toHaveCount(0);
  await expect(visitDialog.getByText("Mitt eget minne från kvällen.")).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Ändra" })).toBeVisible();
  await expectNoLocatorOverflow(visitDialog, "kompletterat fleromdömesscenario");
});
