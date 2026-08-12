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

test("rapporten lämnar gruppkön och handläggningen sker centralt i Platsunderhåll", async ({
  page,
}) => {
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
  const privateObservation =
    "Verksamhetens egen skylt visar en annan webbplats än den som är sparad.";
  await reportDialog.getByLabel("Vad har du sett?").fill(privateObservation);
  await expectNoHorizontalOverflow(page, "Rapportdialog på mobil");
  await reportDialog.getByRole("button", { name: "Skicka underlag" }).click();
  await expect(reportDialog).toBeHidden();

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  await settings.getByRole("button", { name: /Underhåll av matställen/, exact: false }).click();
  const maintenance = page.getByRole("dialog", { name: "Underhåll av matställen" });
  const reportedErrorsSection = maintenance.getByRole("region", { name: "Rapporterade fel" });

  await expect(reportedErrorsSection.getByText("Ingen separat gruppkö längre")).toBeVisible();
  await expect(reportedErrorsSection.getByText(/handläggningen sker centralt i Platsunderhåll/)).toBeVisible();
  await expect(reportedErrorsSection.getByRole("link", { name: /Hantera rapporterade fel/ })).toHaveCount(
    0,
  );
  await expectNoHorizontalOverflow(page, "Reducerad gruppvy för rapporterade fel");

  await page.goto("/rapporterade-fel?demo=1");
  await expect(page.getByRole("heading", { name: "Rapporterade fel", level: 1 })).toBeVisible();
  await expect(page.getByText("Den tidigare gruppspecifika arbetskön används inte längre.")).toBeVisible();
  await expect(page.getByText(/handläggningen sker centralt i Platsunderhåll/)).toBeVisible();

  await page.goto("/platsunderhall?demo=1");
  await expect(page.getByRole("heading", { name: "Platsunderhåll" })).toBeVisible();
  await page.getByRole("button", { name: "Användarrapporter", exact: true }).click();
  await expect(page.getByText("Bryggans Bageri", { exact: true })).toBeVisible();
  await expect(page.getByText(privateObservation, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(/Här visas bara neutral platsdata – aldrig gruppnamn, medlemmar eller privata kommentarer/),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Central platsunderhållskö på mobil");
});