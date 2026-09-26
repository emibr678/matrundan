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

async function enterExampleGroup(page: Page) {
  await page.goto("/exempel");
  await expect(page.getByText("Du testar gruppen som Alex, gruppens ägare.")).toBeVisible();
}

test.use({ viewport: { width: 360, height: 800 } });

test("Hem sammanfattar pending omdömen och öppnar rätt kanoniska besök", async ({ page }) => {
  await enterExampleGroup(page);

  const pending = page.getByLabel("Omdömen att komplettera");
  await expect(pending).toBeVisible();
  await expect(pending.getByText("Du har 2 besök att tycka till om")).toBeVisible();
  await expect(pending.getByText(/Senast: Tacoateljén/)).toBeVisible();
  const chooseVisit = pending.getByRole("button", {
    name: "Välj besök att lämna omdöme på",
  });
  await expect(chooseVisit).toBeVisible();
  await expect(pending.getByRole("link", { name: "Se alla besök" })).toHaveCount(0);
  await expect(pending.getByText("Du var med men har inte lämnat ditt omdöme ännu.")).toHaveCount(
    0,
  );
  await expectNoLocatorOverflow(pending, "pending-kortet på Hem");
  await expectNoHorizontalOverflow(page, "Hem med flera pending-besök på 360 px");

  await chooseVisit.click();
  const chooser = page.getByRole("dialog", { name: "Besök att tycka till om" });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("link")).toHaveCount(2);
  await expect(chooser.getByRole("link", { name: /Tacoateljén/ })).toBeVisible();
  await expect(chooser.getByRole("link", { name: /Köttbulleklubben/ })).toBeVisible();
  await expectNoLocatorOverflow(chooser, "väljaren för pending-besök");

  await chooser.getByRole("link", { name: /Tacoateljén/ }).click();
  await expect(page).toHaveURL(/\/besok\?.*visit=v2.*from=home|\/besok\?.*from=home.*visit=v2/);

  let visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Tacoateljén" })).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" })).toBeVisible();
  await expect(visitDialog.getByText("Ditt deltagande", { exact: true })).toHaveCount(0);
  await expect(visitDialog.getByText("Du var med", { exact: true })).toHaveCount(0);
  await expect(visitDialog.getByRole("button", { name: "Jag var inte med" })).toBeVisible();
  await expectNoLocatorOverflow(visitDialog, "pending-besökets detalj");

  await visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" }).click();
  let reviewDialog = page.getByRole("dialog").last();
  await reviewDialog.getByRole("button", { name: "Avbryt" }).click();
  await expect(page).toHaveURL(/\/exempel$/);
  await expect(page.getByText("Du har 2 besök att tycka till om")).toBeVisible();

  await page.getByRole("button", { name: "Välj besök att lämna omdöme på" }).click();
  await page
    .getByRole("dialog", { name: "Besök att tycka till om" })
    .getByRole("link", { name: /Tacoateljén/ })
    .click();

  visitDialog = page.getByRole("dialog").first();
  await visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" }).click();
  reviewDialog = page.getByRole("dialog").last();
  for (const dimension of ["Smak", "Service", "Prisvärdhet", "Atmosfär"]) {
    await reviewDialog.getByRole("button", { name: `${dimension}: 5 av 5` }).click();
  }
  await reviewDialog.getByRole("button", { name: "Spara omdöme" }).click();

  await expect(page).toHaveURL(/\/exempel$/);
  await expect(page.getByText("Du har ett besök att tycka till om")).toBeVisible();
});

test("Besök markerar bara aktuella pending-besök inom uppmärksamhetsfönstret", async ({ page }) => {
  await enterExampleGroup(page);
  await page.goto("/besok");

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

test("Matstället leder till samma pending-besök i stället för nyregistrering", async ({ page }) => {
  await enterExampleGroup(page);
  await page.goto("/matstallen/p3");

  const pending = page.getByLabel("Omdöme att komplettera på matstället");
  await expect(pending).toBeVisible();
  await expect(pending.getByText("Ditt omdöme saknas", { exact: true })).toBeVisible();
  await expect(pending.getByRole("button", { name: "Lämna omdöme" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök igen" })).toBeVisible();

  const pendingVisitRow = page
    .getByRole("button", { name: /Öppna besök av/ })
    .filter({ hasText: "Ditt omdöme saknas" });
  await expect(pendingVisitRow).toHaveCount(1);
  await expectNoLocatorOverflow(pending, "pending-signalen på matstället");
  await expectNoHorizontalOverflow(page, "matställe med pending-omdöme på 360 px");

  await pending.getByRole("button", { name: "Lämna omdöme" }).click();
  await expect(page).toHaveURL(/\/matstallen\/p3\?visit=v2$/);

  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Tacoateljén" })).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" })).toBeVisible();
});
