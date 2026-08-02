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

test("gruppen granskar och simulerar en anonym OSM-anteckning privat", async ({ page }) => {
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

  await expect(
    page.getByText(
      "Stället räknas som provat så fort någon i gänget varit här — alla behöver inte gå hit.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Om stället", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rapportera felaktig uppgift" }).click();
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

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  const placeDataSection = settings.getByRole("region", { name: "Platsdata" });

  await expect(placeDataSection.getByText("1 att granska")).toBeVisible();
  await expect(placeDataSection.getByText(/särskilt granskad text och kartposition/)).toBeVisible();
  await placeDataSection.getByText("Glöd & Grönska", { exact: true }).click();
  await expect(placeDataSection.getByLabel("Bedömning")).toHaveCount(0);
  await expect(placeDataSection.getByText("Välj nästa steg", { exact: true })).toBeVisible();
  await placeDataSection
    .getByLabel("Intern anteckning (valfri)")
    .fill("Kontrollerad mot verksamhetens officiella information.");
  await expectNoHorizontalOverflow(page, "Granskningskö på mobil");
  await placeDataSection.getByRole("button", { name: "Förbered för OpenStreetMap" }).click();

  await expect(
    placeDataSection.locator("summary").getByText("Förberedd för OpenStreetMap", { exact: true }),
  ).toBeVisible();
  await expect(placeDataSection.getByText("1 att granska")).toHaveCount(0);
  await expect(
    placeDataSection.getByText(/Rapporten är förberedd för OpenStreetMap/),
  ).toBeVisible();

  const publicText = placeDataSection.getByLabel("Offentlig text till OpenStreetMap");
  await expect(publicText).toHaveValue(/Webbplatsen i kartdatan verkar vara fel/);
  await publicText.fill(
    "Webbplatsen i kartdatan verkar vara inaktuell. Verksamhetens skylt visar en annan officiell webbplats.",
  );
  await expectNoHorizontalOverflow(page, "Offentlig OSM-text på mobil");
  await placeDataSection.getByRole("button", { name: "Publicera anonym OSM-anteckning" }).click();

  const confirmation = page.getByRole("alertdialog", {
    name: "Publicera offentligt till OpenStreetMap?",
  });
  await expect(
    confirmation.getByText(/kan inte redigeras, kommenteras eller stängas/),
  ).toBeVisible();
  await confirmation.getByRole("button", { name: "Publicera anonymt" }).click();

  await expect(placeDataSection.getByText(/Simulerad OSM-anteckning/)).toBeVisible();
  await expect(
    placeDataSection.locator("summary").getByText("Öppen i OpenStreetMap", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Simulerad OSM-anteckning på mobil");

  await placeDataSection.getByRole("button", { name: "Kontrollera OSM-status" }).click();
  await expect(placeDataSection.getByText(/Senast kontrollerad/)).toBeVisible();
});
