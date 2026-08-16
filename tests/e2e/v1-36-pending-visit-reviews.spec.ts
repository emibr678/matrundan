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

test("Hem sammanfattar pending omdömen och öppnar rätt kanoniska besök", async ({ page }) => {
  await page.goto("/exempel");

  const pending = page.getByLabel("Omdömen att komplettera");
  await expect(pending).toBeVisible();
  await expect(pending.getByText("2 besök väntar på ditt omdöme")).toBeVisible();
  await expect(pending.getByText("Tacoateljén", { exact: true })).toBeVisible();
  await expect(pending.getByRole("link", { name: "Öppna besöket" })).toBeVisible();
  await expect(pending.getByRole("link", { name: "Se alla besök" })).toBeVisible();
  await expectNoLocatorOverflow(pending, "pending-kortet på Hem");
  await expectNoHorizontalOverflow(page, "Hem med flera pending-besök på 360 px");

  await pending.getByRole("link", { name: "Öppna besöket" }).click();
  await expect(page).toHaveURL(/\/besok\?visit=v2$/);

  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Tacoateljén" })).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" })).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Jag var inte med" })).toBeVisible();
  await expectNoLocatorOverflow(visitDialog, "pending-besökets detalj");
});

test("Besök markerar bara aktuella pending-besök inom uppmärksamhetsfönstret", async ({
  page,
}) => {
  await page.goto("/exempel");
  await page
    .getByLabel("Omdömen att komplettera")
    .getByRole("link", { name: "Se alla besök" })
    .click();
  await expect(page).toHaveURL(/\/besok$/);

  const tacoVisit = page.getByRole("button", { name: /Öppna besöket på Tacoateljén/ });
  const formerMemberVisit = page.getByRole("button", {
    name: /Öppna besöket på Köttbulleklubben/,
  });
  const repeatCafeVisits = page.getByRole("button", { name: /Öppna besöket på Kardemummaköket/ });

  await expect(tacoVisit.getByText("Ditt omdöme saknas", { exact: true })).toBeVisible();
  await expect(formerMemberVisit.getByText("Ditt omdöme saknas", { exact: true })).toBeVisible();
  await expect(repeatCafeVisits.getByText("Ditt omdöme saknas", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Ditt omdöme saknas", { exact: true })).toHaveCount(2);
  await expectNoHorizontalOverflow(page, "Besök med pending-markeringar på 360 px");
});
