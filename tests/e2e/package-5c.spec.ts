import { expect, test, type Page } from "@playwright/test";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAwMAAAAYAAeIhvDMAAAAASUVORK5CYII=",
  "base64",
);

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(metrics.scroll, `${context}: ingen horisontell overflow`).toBeLessThanOrEqual(metrics.client);
}

test("ett besöksfoto sparas privat i demosessionen och kan tas bort", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => {
    localStorage.removeItem("matrundan.state.v1");
    sessionStorage.clear();
  });
  await page.goto("/matstallen/p2?demo=1");

  await page.getByRole("button", { name: "Registrera besök" }).first().click();
  const visitDialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(visitDialog).toBeVisible();
  await visitDialog.getByLabel("Välj foto från besöket").setInputFiles({
    name: "fredagsfika.png",
    mimeType: "image/png",
    buffer: PNG_1PX,
  });
  await expect(visitDialog.getByAltText("Förhandsvisning av valt besöksfoto")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Besöksdialog med bildförhandsvisning");

  await visitDialog.getByRole("button", { name: "Spara besök" }).click();
  await expect(visitDialog).toBeHidden();

  const newestVisit = page.getByRole("button", { name: /Öppna besök av Alex/ }).first();
  await newestVisit.click();
  await expect(page.getByAltText("Foto från besöket").first()).toBeVisible();
  await expect(page.getByText(/Fotot är privat för den här gruppen/)).toBeVisible();
  await expectNoHorizontalOverflow(page, "Besöksdetalj med foto");

  await page.reload();
  await page.getByRole("button", { name: /Öppna besök av Alex/ }).first().click();
  await expect(page.getByAltText("Foto från besöket").first()).toBeVisible();

  await page.getByRole("button", { name: "Ta bort foto" }).click();
  await expect(page.getByAltText("Foto från besöket")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Lägg till ett minne från besöket/ })).toBeVisible();
});
