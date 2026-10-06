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

async function openManualAdd(page: Page) {
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const searchDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await searchDialog
    .getByRole("button", { name: "Lägg till ett ställe som saknas", exact: true })
    .click();
  const manualDialog = page.getByRole("dialog", { name: "Stället saknas i sökningen" });
  await expect(manualDialog).toBeVisible();
  return manualDialog;
}

test("ett manuellt ställe behåller sin historik när en senare källa länkas", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");
  await page.evaluate(() => {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        key === "matrundan.state.v1" ||
        key?.startsWith("matrundan.manual-place-source-links.v1.")
      ) {
        window.localStorage.removeItem(key);
      }
    }
  });
  await page.reload();

  const manualDialog = await openManualAdd(page);
  await manualDialog.getByLabel("Namn").fill("Hagabackens Kafferum");
  const locationInput = manualDialog.getByPlaceholder("Sök adress eller plats");
  await locationInput.fill("Backstigen 11, Göteborg");
  await locationInput.press("Enter");
  await expect(manualDialog.getByText(/Verifierad plats.*Haga.*Göteborg/)).toBeVisible();
  await expectNoHorizontalOverflow(page, "Manuellt tillägg på mobil");
  await manualDialog.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
  await expect(manualDialog).toBeHidden();

  const placeLink = page.getByRole("link", { name: /Hagabackens Kafferum/ });
  await expect(placeLink).toBeVisible();
  const hrefBeforeLinking = await placeLink.getAttribute("href");
  expect(hrefBeforeLinking).toBeTruthy();

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  const matchRegion = addDialog.getByRole("region", { name: "Möjliga matchningar i gruppen" });
  await expect(matchRegion.getByText("Är det samma ställe?", { exact: true })).toBeVisible();
  await expect(matchRegion.getByText(/Samma namn och kartposition i närheten/)).toBeVisible();
  await expectNoHorizontalOverflow(page, "Möjlig källmatchning på mobil");
  await matchRegion.getByRole("button", { name: "Granska matchning" }).click();

  const confirmation = page.getByRole("alertdialog", {
    name: "Är det samma ställe?",
  });
  await expect(confirmation.getByText(/Kartinformationen kompletterar/)).toBeVisible();
  await expect(
    confirmation.getByText(/Besök, omdömen och gruppuppgifter ligger kvar/),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Bekräftelse av källkoppling på mobil");
  await page.screenshot({ path: "visual-review/issue-389-demo-source-comparison-mobile.png" });
  await confirmation.getByRole("button", { name: "Ja, använd stället som redan finns" }).click();
  await expect(confirmation).toBeHidden();

  await expect(addDialog.getByText("1 ställe hanterat i den här omgången")).toBeVisible();
  const existingSection = addDialog
    .getByRole("button", { name: /Redan i gruppen \(\d+\)/ })
    .first();
  await expect(existingSection).toBeVisible();
  await existingSection.click();
  await expect(
    addDialog.getByRole("button", { name: /Hagabackens Kafferum/ }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Länkad källa i sökresultatet på mobil");
  await addDialog.getByRole("button", { name: "Klar" }).click();

  const samePlaceLink = page.getByRole("link", { name: /Hagabackens Kafferum/ });
  await expect(samePlaceLink).toHaveAttribute("href", hrefBeforeLinking!);
});
