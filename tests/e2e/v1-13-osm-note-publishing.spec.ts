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

test("gruppen granskar och simulerar ett rättelseförslag privat", async ({ page }) => {
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

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  await settings.getByRole("button", { name: /Underhåll av matställen/, exact: false }).click();
  const maintenance = page.getByRole("dialog", { name: "Underhåll av matställen" });
  const reportedErrorsSection = maintenance.getByRole("region", { name: "Rapporterade fel" });

  await expect(reportedErrorsSection.getByText("1 att granska")).toBeVisible();
  await expect(
    reportedErrorsSection.getByText(/Stängda matställen, fel namn, adresser/),
  ).toBeVisible();
  await reportedErrorsSection.getByRole("link", { name: /Hantera rapporterade fel/ }).click();

  await expect(page.getByRole("heading", { name: "Rapporterade fel", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Att granska 1/ })).toBeVisible();
  await page.getByText("Glöd & Grönska", { exact: true }).click();

  const reportSheet = page.getByRole("dialog");
  await expect(reportSheet.getByRole("heading", { name: "Glöd & Grönska" })).toBeVisible();
  await expect(reportSheet.getByText("Välj nästa steg", { exact: true })).toBeVisible();
  await expect(
    reportSheet.getByText("OpenStreetMap, en öppen karta", { exact: false }),
  ).toHaveCount(0);
  await reportSheet
    .getByLabel("Intern anteckning")
    .fill("Kontrollerad mot verksamhetens officiella information.");
  await expectNoHorizontalOverflow(page, "Granskningskö på mobil");
  await reportSheet.getByRole("button", { name: "Fortsätt till rättelseförslag" }).click();

  await expect(reportSheet.getByText("Hjälp till att rätta uppgiften på kartan")).toBeVisible();
  await expect(
    reportSheet.getByText("OpenStreetMap, en öppen karta", { exact: false }),
  ).toBeVisible();

  const publicText = reportSheet.getByLabel("Text som skickas till OpenStreetMap");
  await expect(publicText).toHaveValue(/Webbplatsen i kartdatan verkar vara fel/);
  await publicText.fill(
    "Webbplatsen i kartdatan verkar vara inaktuell. Verksamhetens skylt visar en annan officiell webbplats.",
  );
  await expectNoHorizontalOverflow(page, "Text för rättelseförslag på mobil");
  await reportSheet.getByRole("button", { name: "Skicka rättelseförslag" }).click();

  const confirmation = page.getByRole("alertdialog", {
    name: "Skicka rättelseförslaget?",
  });
  await expect(
    confirmation.getByText(/kan inte redigeras eller tas bort från Matrundan/),
  ).toBeVisible();
  await confirmation.getByRole("button", { name: "Skicka förslaget" }).click();

  await expect(reportSheet.getByText("Väntar på granskning", { exact: true })).toBeVisible();
  await expect(
    reportSheet.getByText(
      "Rättelseförslaget har skickats till OpenStreetMap och väntar på att granskas.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(reportSheet.getByRole("button", { name: "Skicka rättelseförslag" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Simulerat rättelseförslag på mobil");

  await reportSheet.getByRole("button", { name: "Uppdatera status" }).click();
  await expect(reportSheet.getByText(/Senast uppdaterad/)).toBeVisible();
});
