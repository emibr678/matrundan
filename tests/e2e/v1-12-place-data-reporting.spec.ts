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

test("gruppen rapporterar och granskar felaktig platsdata privat", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen/p5?demo=1");
  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("matrundan.place-data-reports.v1.")) {
        window.localStorage.removeItem(key);
      }
    }
  });
  await page.goto("/matstallen/p5?demo=1");

  await page.getByRole("button", { name: "Rapportera fel" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Rapportera platsinformation" });
  await expect(reportDialog.getByText(/privat inom gruppen/)).toBeVisible();
  await reportDialog.getByLabel("Vad verkar vara fel?").selectOption("wrong_website");
  await reportDialog
    .getByLabel("Vad har du sett?")
    .fill("Verksamhetens egen skylt visar en annan webbplats än den som är sparad.");
  await expectNoHorizontalOverflow(page, "Rapportdialog på mobil");
  await reportDialog.getByRole("button", { name: "Skicka rapport" }).click();
  await expect(reportDialog).toBeHidden();

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  const placeDataSection = settings.locator("section").filter({
    has: settings.getByRole("heading", { name: "Platsdata", exact: true }),
  });

  await expect(placeDataSection.getByText("1 att granska")).toBeVisible();
  await expect(placeDataSection.getByText(/publicerar ingenting ännu/)).toBeVisible();
  await placeDataSection.getByText("Glöd & Grönska", { exact: true }).click();
  await placeDataSection.getByLabel("Bedömning").selectOption("ready_for_osm");
  await placeDataSection
    .getByLabel("Intern anteckning (valfri)")
    .fill("Kontrollerad mot verksamhetens officiella information.");
  await expectNoHorizontalOverflow(page, "Granskningskö på mobil");
  await placeDataSection.getByRole("button", { name: "Spara bedömning" }).click();

  await expect(
    placeDataSection.getByText("Förberedd för OpenStreetMap", { exact: true }),
  ).toBeVisible();
  await expect(placeDataSection.getByText("1 att granska")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Sparad OSM-förberedelse på mobil");
});
