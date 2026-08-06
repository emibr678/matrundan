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

test("utloggad användare möts av landningssidan i stället för en fiktiv grupp", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Hitta nästa ställe – och minns rundorna tillsammans." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Fortsätt med Google" })).toBeVisible();
  await expect(page.getByLabel("Inbjudningslänk eller kod")).toBeVisible();
  await expect(page.getByText("Exempelgrupp", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Öppna exempelgruppen/ })).toBeVisible();
  await expect(page.getByText("Fredagsgänget", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/skrivskydd/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Landningssidan på 360 px");
});

test("Fredagsgänget är interaktivt och sparar bara i den aktuella fliken", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "matrundan.state.v1",
      JSON.stringify({ group: { name: "Gammal lokal demo" } }),
    );
    window.sessionStorage.setItem(
      "matrundan.exampleState.v1",
      JSON.stringify({ group: { name: "Gammal exempelgrupp" } }),
    );
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await expect(page.getByText(/ändringar sparas bara tillfälligt i den här fliken/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gröna Terrassen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till ställe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa" })).toBeVisible();
  await expect(page.getByText("Gammal lokal demo")).toHaveCount(0);
  await expect(page.getByText("Gammal exempelgrupp")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Exempelgruppen på 360 px");

  await page.goto("/matstallen/p8");
  await page.getByRole("button", { name: "Markera som favorit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ta bort favorit", exact: true })).toBeVisible();

  const storage = await page.evaluate(() => ({
    current: window.sessionStorage.getItem("matrundan.exampleState.v2"),
    legacy: window.sessionStorage.getItem("matrundan.exampleState.v1"),
    sandbox: window.localStorage.getItem("matrundan.state.v1"),
  }));
  expect(storage.current).toContain('"placeId":"p8"');
  expect(storage.legacy).toContain("Gammal exempelgrupp");
  expect(storage.sandbox).toContain("Gammal lokal demo");

  await page.reload();
  await expect(page.getByRole("button", { name: "Ta bort favorit", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Hem" }).click();
  await page.getByRole("button", { name: "Återställ" }).click();
  await expect(page.getByText("Exempelgruppen är återställd.", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p8");
  await expect(
    page.getByRole("button", { name: "Markera som favorit", exact: true }),
  ).toBeVisible();
});

test("exempelgruppens centrala scenarier går att nå utan privat dataläckage", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p2");
  await expect(page.getByRole("heading", { name: "Kardemummaköket" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Besök (2)" })).toBeVisible();
  await page.getByRole("button", { name: /Öppna besök av Alex/ }).click();
  await expect(page.getByRole("heading", { name: "Foto från besöket" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ta bort foto" })).toBeVisible();

  await page.goto("/matstallen/p3?visit=v2");
  await expect(page.getByText("Aya", { exact: true })).toBeVisible();
  await expect(page.getByText("· Gäst", { exact: true })).toBeVisible();
  await expect(page.getByText(/Gäster hör bara till detta besök/)).toBeVisible();

  await page.goto("/matstallen/p6?visit=v3");
  await expect(page.getByText("Lina", { exact: true })).toBeVisible();
  await expect(page.getByText("· Tidigare medlem", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9");
  await expect(page.getByText("Delat besök", { exact: true })).toBeVisible();
  await expect(
    page.getByTitle("Personer utanför den här gruppen visas anonymt."),
  ).toContainText("+2 utanför gruppen");
  await expect(page.getByText("Aya", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Lina", { exact: true })).toHaveCount(0);

  await page.goto("/matstallen/p4");
  await expect(page.getByRole("heading", { name: "Brödverket 47" })).toBeVisible();
  await expect(
    page.getByText("Inte längre i gruppens lista", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Besök (1)" })).toBeVisible();

  await page.goto("/matstallen/p10");
  await expect(
    page.getByRole("heading", { name: "Det lilla långbordet vid Tegelbackens gröna gård" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sankt Eriksgatan 123, gårdshuset längst in till vänster", {
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Långt exempelställe på 360 px");
});

test("exempelgruppen kan lämnas via menyn och Matrundan-logotypen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  await page.getByRole("link", { name: "Hem", exact: true }).click();
  await expect(page).toHaveURL(/\/exempel$/);
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" }).click();
  await page.getByRole("menuitem", { name: "Till startsidan", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Hitta nästa ställe – och minns rundorna tillsammans." }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem("matrundan.exampleSession.v1")))
    .toBeNull();
  await expectNoHorizontalOverflow(page, "Landningssidan efter exempelmenyn");

  await page.getByRole("link", { name: /Öppna exempelgruppen/ }).click();
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Matrundan/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Hitta nästa ställe – och minns rundorna tillsammans." }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem("matrundan.exampleSession.v1")))
    .toBeNull();
  await expectNoHorizontalOverflow(page, "Landningssidan efter Matrundan-logotypen");
});

test("den interna demosandboxen är fortsatt skrivbar och separat", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?demo=1");

  await expect(page.getByRole("button", { name: "Lägg till ställe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toBeVisible();
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Intern demosandbox på 360 px");
});
