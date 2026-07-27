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

test("ägaren kan arkivera och återaktivera en grupp i demo-läget", async ({ page }) => {
  await page.goto("/?demo=1");

  await page.getByRole("button", { name: "Demo" }).click();
  await page.getByRole("menuitem", { name: "Arkivera gruppen" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText(/Historik, besök, ställen/)).toBeVisible();
  await confirm.getByRole("button", { name: "Arkivera gruppen" }).click();

  await expect(page.getByText("Gruppen är arkiverad", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till ställe" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Arkiverad grupp");

  await page.getByRole("button", { name: "Demo" }).click();
  await page.getByRole("menuitem", { name: "Återaktivera gruppen" }).click();
  await expect(page.getByText("Gruppen är arkiverad", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lägg till ställe" })).toBeVisible();
});

test("adminflödet arkiverar och återställer bara gruppens platskoppling", async ({ page }) => {
  await page.goto("/matstallen/p5?demo=1");

  await page.getByRole("button", { name: "Hantera ställe" }).click();
  const dialog = page.getByRole("dialog", { name: /Hantera Glöd & Grönska/ });
  await expect(dialog.getByText(/gäller bara i Fredagsgänget/)).toBeVisible();
  await dialog.getByRole("button", { name: "Arkivera stället" }).click();

  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Arkivera stället" }).click();
  await expect(page.getByText("Arkiverat i gruppen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toHaveCount(0);

  await page.getByRole("button", { name: "Hantera ställe" }).click();
  await page
    .getByRole("dialog", { name: /Hantera Glöd & Grönska/ })
    .getByRole("button", { name: "Återställ stället" })
    .click();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Återställt matställe");
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

  await expect(visitSheet.getByText("Uppdaterad minnesnotering från testet.")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redigerat eget omdöme");
});
