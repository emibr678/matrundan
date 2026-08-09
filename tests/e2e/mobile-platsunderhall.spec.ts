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

test("Platsunderhåll följer arbetsstatus och ursprung utan horisontell overflow", async ({
  page,
}) => {
  await page.goto("/platsunderhall?demo=1");

  const inboxQueue = page.getByRole("button", { name: /^Att hantera \d+$/ });
  const osmQueue = page.getByRole("button", { name: /^OSM-arbete \d+$/ });
  const closedQueue = page.getByRole("button", { name: /^Avslutade \d+$/ });
  const allFilter = page.getByRole("button", { name: "Alla", exact: true });
  const reportsFilter = page.getByRole("button", { name: "Användarrapporter", exact: true });
  const manualFilter = page.getByRole("button", { name: "Manuellt tillagda", exact: true });
  const detail = page.getByRole("region", { name: "Underhållsdetalj" });

  await expect(page.getByRole("heading", { name: "Platsunderhåll" })).toBeVisible();
  await expect(page.getByText("Fiktiv demodata för utveckling")).toBeVisible();
  await expect(page.getByText(/Granska platser där kartdatan behöver kontrolleras/)).toBeVisible();
  await expect(inboxQueue).toBeVisible();
  await expect(osmQueue).toBeVisible();
  await expect(closedQueue).toBeVisible();
  await expect(allFilter).toBeVisible();
  await expect(reportsFilter).toBeVisible();
  await expect(manualFilter).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kajkanten" })).toBeVisible();
  await expect(detail.getByText("Fel webbplats", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Markera för OSM-arbete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Markera som löst" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – att hantera");

  await manualFilter.click();
  await expect(page.getByRole("heading", { name: "Bistro Malma Kvarn" })).toBeVisible();
  await expect(detail.getByText("Behöver kartkontroll", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sök efter kartträff" }).click();
  await expect(page.getByText("Möjliga kartträffar")).toBeVisible();
  await expect(page.getByText("Bistro Malma Kvarn & Krog")).toBeVisible();
  await page.getByRole("button", { name: "Koppla till stället" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Koppla kartträffen?");
  await expect(page.getByRole("alertdialog")).toContainText("Besök och gruppdata påverkas inte");
  await page.getByRole("button", { name: "Avbryt" }).click();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – kartträff");

  await osmQueue.click();
  await expect(page.getByRole("heading", { name: "Sjöstugan" })).toBeVisible();
  await expect(page.getByText(/När det finns som en tydlig kartträff/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Öppna OpenStreetMap" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kopiera platsinfo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sök efter kartträff igen" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – manuellt OSM-arbete");

  await reportsFilter.click();
  await expect(page.getByRole("heading", { name: "Bryggans Bageri" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Öppna OSM-not" })).toBeVisible();
  await expect(page.getByText(/Rätta uppgiften i OpenStreetMap eller Every Door/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Markera som löst" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – rapport i OSM-arbete");

  await closedQueue.click();
  await expect(page.getByRole("heading", { name: "Hamnboden" })).toBeVisible();
  await expect(detail.getByText("Avfärdat", { exact: true })).toBeVisible();

  await manualFilter.click();
  await expect(page.getByRole("heading", { name: "Hamnkrogen" })).toBeVisible();
  await expect(detail.getByText("Löst", { exact: true })).toBeVisible();
  await expect(page.getByText("En kartkälla är kopplad och ärendet är avslutat.")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Platsunderhåll – avslutade");
});
