import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    metrics.documentScrollWidth,
    `${context}: dokumentet får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.documentClientWidth);
  expect(
    metrics.bodyScrollWidth,
    `${context}: body får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth);
}

async function openPersonalJourneyFromGroupMenu(page: Page) {
  await page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" }).click();
  await page.getByRole("menuitem", { name: /Min matresa/ }).click();
}

test("mobilen öppnar Min matresa som lokal yta och återgår till exakt ursprungsroute", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  await page.getByRole("link", { name: "Matställen", exact: true }).click();
  await expect(page).toHaveURL(/\/matstallen$/);

  await openPersonalJourneyFromGroupMenu(page);

  await expect(page).toHaveURL(/\/min-matresa\?demo=1$/);
  await expect(page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Min matresa", level: 1 })).toBeVisible();

  const personalNav = page.getByRole("navigation", { name: "Min matresa" });
  await expect(personalNav).toBeVisible();
  await expect(personalNav.getByRole("link", { name: "Översikt" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator('nav[aria-label="Huvudmeny"]:visible')).toHaveCount(0);

  await personalNav.getByRole("link", { name: "Besök" }).click();
  await expect(page).toHaveURL(/\/min-matresa\/besok\?demo=1$/);
  await expect(personalNav.getByRole("link", { name: "Besök" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/min-matresa\?demo=1$/);

  await page.getByRole("button", { name: "Till Fredagsgänget" }).click();
  await expect(page).toHaveURL(/\/matstallen$/);
  await expect(page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Min matresa på mobil");
});

test("direkt personlig route i exempelkontext faller säkert tillbaka till exempelgruppen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("matrundan.exampleSession.v1", "1");
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/min-matresa");

  await expect(page.getByRole("heading", { name: "Min matresa", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" })).toBeVisible();

  await page.getByRole("button", { name: "Till Fredagsgänget" }).click();
  await expect(page).toHaveURL(/\/exempel$/);
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
});

test("desktop behåller global gruppnavigation och lämnar Min matresa genom den", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/exempel");

  await openPersonalJourneyFromGroupMenu(page);

  await expect(page).toHaveURL(/\/min-matresa\?demo=1$/);
  const globalNav = page.getByRole("navigation", { name: "Huvudmeny" });
  const personalNav = page.getByRole("navigation", { name: "Min matresa" });

  await expect(globalNav).toBeVisible();
  await expect(personalNav).toBeVisible();
  await expect(globalNav.getByRole("link", { name: "Hem" })).toBeVisible();
  await expect(globalNav.getByRole("link", { name: "Matställen" })).toBeVisible();
  await expect(globalNav.getByRole("link", { name: "Gruppen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" })).toBeVisible();

  await globalNav.getByRole("link", { name: "Matställen" }).click();
  await expect(page).toHaveURL(/\/matstallen$/);
  await expect(page.getByRole("navigation", { name: "Min matresa" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" })).toBeVisible();
});

test("flera skrivbara grupper kräver ett uttryckligt gruppval för omdömet", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");
  await openPersonalJourneyFromGroupMenu(page);

  const pendingSection = page.getByRole("region", { name: "Omdömen att komplettera" });
  await expect(pendingSection.getByText(/2 grupper/)).toBeVisible();
  await pendingSection.getByRole("button", { name: "Skriv omdöme" }).click();

  const dialog = page.getByRole("dialog", { name: "Välj grupp" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Fredagsgänget" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Familjen" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Gruppval för omdöme");
});
