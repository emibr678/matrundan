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

test("demo-läget visar lokala inställningar utan livegruppens statuskontroller", async ({
  page,
}) => {
  await page.goto("/gruppen?demo=1");

  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  await expect(settings.getByText("Demo-läge: skrivningar sparas bara lokalt.")).toBeVisible();
  await expect(settings.getByRole("button", { name: "Återställ demo-data" })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Arkivera gruppen" })).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Återaktivera gruppen" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Gruppinställningar i demo-läget");
});

test("adminflödet tar bort och lägger tillbaka bara gruppens platskoppling", async ({ page }) => {
  await page.goto("/matstallen/p5?demo=1");

  await page.getByRole("button", { name: "Hantera ställe" }).click();
  const dialog = page.getByRole("dialog", { name: /Hantera Glöd & Grönska/ });
  await expect(dialog.getByText(/gäller bara i Fredagsgänget/)).toBeVisible();
  await dialog.getByRole("button", { name: "Ta bort från gruppen" }).click();

  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Ta bort från gruppen" }).click();
  await expect(
    page.getByText("Inte längre i gruppens lista", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toHaveCount(0);

  await page.getByRole("button", { name: "Hantera ställe" }).click();
  await page
    .getByRole("dialog", { name: /Hantera Glöd & Grönska/ })
    .getByRole("button", { name: "Lägg tillbaka i gruppen" })
    .click();
  await expect(page.getByRole("button", { name: "Registrera besök" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Tillbakalagt matställe");
});

test("en medlem kan redigera endast sitt eget omdöme", async ({ page }) => {
  await page.goto("/matstallen/p2?demo=1&visit=v1");

  const visitSheet = page.getByRole("dialog");
  await expect(visitSheet.getByRole("heading", { name: "Kvarterets Kardemumma" })).toBeVisible();
  await visitSheet.getByRole("button", { name: "Redigera mitt omdöme" }).click();

  const editDialog = page.getByRole("dialog", { name: "Redigera ditt omdöme" });
  const comment = editDialog.getByLabel("Kommentar (frivilligt)");
  await comment.fill("Uppdaterad minnesnotering från testet.");
  await editDialog.getByRole("button", { name: "Spara omdöme" }).click();

  await expect(
    visitSheet.getByText("Uppdaterad minnesnotering från testet.").first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redigerat eget omdöme");
});

test("registreraren kan radera ett originalbesök med tydlig konsekvens", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen/p2?demo=1");
  await page.evaluate(() => window.localStorage.removeItem("matrundan.state.v1"));
  await page.goto("/matstallen/p2?demo=1&visit=v1");

  const visitSheet = page.getByRole("dialog");
  await expect(visitSheet.getByRole("heading", { name: "Kvarterets Kardemumma" })).toBeVisible();
  await visitSheet.getByRole("button", { name: "Radera besöket" }).click();

  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText(/fotot och alla omdömen tas bort/)).toBeVisible();
  await expect(confirm.getByText(/försvinner det även där/)).toBeVisible();
  await expectNoHorizontalOverflow(page, "Bekräfta radering av besök");
  await confirm.getByRole("button", { name: "Radera besöket" }).click();

  await expect(page.getByRole("heading", { name: "Besök (2)" })).toBeVisible();
  await page.goto("/gruppen?demo=1");
  await expect(
    page.getByText("Emilia registrerade ett besök på Kvarterets Kardemumma", { exact: true }),
  ).toHaveCount(0);
});
