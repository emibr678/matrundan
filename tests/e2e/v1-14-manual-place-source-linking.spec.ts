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

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  let addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await addDialog.getByRole("button", { name: "Lägg till manuellt" }).click();
  await addDialog.getByLabel("Namn").fill("Päronträdets Trattoria");
  await addDialog.getByLabel("Adress").fill("Pärongränden 6");
  await expectNoHorizontalOverflow(page, "Manuellt tillägg på mobil");
  await addDialog.getByRole("button", { name: "Lägg till", exact: true }).click();
  await expect(addDialog).toBeHidden();

  const placeLink = page.getByRole("link", { name: /Päronträdets Trattoria/ });
  await expect(placeLink).toBeVisible();
  const hrefBeforeLinking = await placeLink.getAttribute("href");
  expect(hrefBeforeLinking).toBeTruthy();

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  const matchRegion = addDialog.getByRole("region", { name: "Möjliga matchningar i gruppen" });
  await expect(matchRegion.getByText("Möjlig match i gruppen", { exact: true })).toBeVisible();
  await expect(matchRegion.getByText(/Samma namn och adress/)).toBeVisible();
  await expectNoHorizontalOverflow(page, "Möjlig källmatchning på mobil");
  await matchRegion.getByRole("button", { name: "Granska länk" }).click();

  const confirmation = page.getByRole("alertdialog", {
    name: "Länka till befintligt matställe?",
  });
  await expect(confirmation.getByText(/Bara den externa källidentiteten länkas/)).toBeVisible();
  await expect(
    confirmation.getByText(/besök, omdömen och privata gruppuppgifter bevaras/),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Bekräftelse av källkoppling på mobil");
  await confirmation.getByRole("button", { name: "Länka källa" }).click();
  await expect(confirmation).toBeHidden();

  await expect(addDialog.getByText("1 ställe hanterat i den här omgången")).toBeVisible();
  const existingSection = addDialog
    .getByRole("button", { name: /Redan i gruppen \(\d+\)/ })
    .first();
  await expect(existingSection).toBeVisible();
  await existingSection.click();
  await expect(
    addDialog.getByRole("button", { name: /Päronträdets Trattoria/ }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Länkad källa i sökresultatet på mobil");
  await addDialog.getByRole("button", { name: "Klar" }).click();

  const samePlaceLink = page.getByRole("link", { name: /Päronträdets Trattoria/ });
  await expect(samePlaceLink).toHaveAttribute("href", hrefBeforeLinking!);
});
