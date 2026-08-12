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

async function openMaintenanceItem(page: Page, name: string) {
  await page
    .locator("section:not([aria-label='Underhållsdetalj']) button", { hasText: name })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Underhållsdetalj" })).toBeVisible();
}

test("rapporten lämnar gruppens privata arbetskö och hanteras centralt", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen/p5?demo=1");
  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        key?.startsWith("matrundan.place-data-reports.v1.") ||
        key?.startsWith("matrundan.place-data-reports.v2.")
      ) {
        window.localStorage.removeItem(key);
      }
    }
  });
  await page.goto("/matstallen/p5?demo=1");

  await expect(page.getByRole("heading", { name: "Om stället", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rapportera felaktig information" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Rapportera felaktig uppgift" });
  await expect(
    reportDialog.getByText(/Du lämnar ett underlag till gruppens ägare och administratörer/),
  ).toBeVisible();
  await reportDialog.getByLabel("Vad gäller uppgiften?").selectOption("wrong_website");
  await reportDialog
    .getByLabel("Vad har du sett?")
    .fill("Verksamhetens egen skylt visar en annan webbplats än den som är sparad.");
  await expectNoHorizontalOverflow(page, "Rapportdialog på mobil");
  await reportDialog.getByRole("button", { name: "Skicka underlag" }).click();
  await expect(reportDialog).toBeHidden();

  await page.goto("/rapporterade-fel?demo=1");
  await expect(page.getByRole("heading", { name: "Rapporterade fel", level: 1 })).toBeVisible();
  await expect(
    page.getByText("Den tidigare gruppspecifika arbetskön används inte längre."),
  ).toBeVisible();
  await expect(page.getByText(/handläggningen sker centralt i Platsunderhåll/)).toBeVisible();
  await expect(
    page.getByText(/Gruppnamn, medlemskap och historisk privat rapporttext skickas inte/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Att granska/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Skicka rättelseförslag/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Pensionerad grupparbetskö");

  await page.goto("/platsunderhall?demo=1");
  await expect(page.getByRole("heading", { name: "Platsunderhåll" })).toBeVisible();
  await expect(
    page.getByText(/Här visas bara neutral platsdata – aldrig gruppnamn, medlemmar eller privata kommentarer/),
  ).toBeVisible();

  await page.getByRole("button", { name: /^OSM-arbete(?: \d+)?$/ }).click();
  await page.getByRole("button", { name: "Användarrapporter", exact: true }).click();
  await openMaintenanceItem(page, "Bryggans Bageri");

  const detail = page.getByRole("region", { name: "Underhållsdetalj" });
  await expect(detail.getByRole("link", { name: "Öppna OSM-not" })).toBeVisible();
  await expect(detail.getByText(/Rätta uppgiften i OpenStreetMap eller Every Door/)).toBeVisible();
  await expect(detail.getByRole("button", { name: "Markera som löst" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Central platsunderhållsdetalj");
});
