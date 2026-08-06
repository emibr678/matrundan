import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const widths = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));

  expect(
    widths.documentScroll,
    `${context}: dokumentet får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(widths.documentClient);
  expect(widths.bodyScroll, `${context}: body får inte ha horisontell overflow`).toBeLessThanOrEqual(
    widths.bodyClient,
  );
}

test("exempelgruppen visar samma kompakta uppgiftskontroll utan externa anrop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/geoapify|openstreetmap/i.test(request.url())) externalRequests.push(request.url());
  });

  await page.goto("/exempel");
  await expect(page.getByText(/Du testar gruppen som Alex/)).toBeVisible();
  await page.getByRole("link", { name: "Matställen" }).last().click();
  await page.getByRole("link", { name: /Gröna Terrassen/ }).click();

  const practicalInfo = page.getByTestId("place-practical-info");
  const addressRow = page.getByTestId("place-address-row");
  const compactRow = page.getByTestId("place-practical-links");
  const website = page.getByRole("link", { name: "Öppna webbplatsen för Gröna Terrassen" });
  const openingHours = page.getByLabel(/^Öppettider:/);
  const trigger = page.getByRole("button", {
    name: "Kontrollera uppgifter – nya uppgifter finns",
  });

  await expect(practicalInfo).toBeVisible();
  await expect(addressRow).toBeVisible();
  await expect(compactRow).toBeVisible();
  await expect(website).toBeVisible();
  await expect(openingHours).toBeVisible();
  await expect(trigger).toBeVisible();
  await expect(page.getByTestId("place-info-status-dot")).toBeVisible();
  await expect(page.getByTestId("next-stop-accent")).toHaveCount(0);

  const [addressBox, compactBox, websiteBox, openingBox, triggerBox] = await Promise.all([
    addressRow.boundingBox(),
    compactRow.boundingBox(),
    website.boundingBox(),
    openingHours.boundingBox(),
    trigger.boundingBox(),
  ]);
  expect(addressBox).not.toBeNull();
  expect(compactBox).not.toBeNull();
  expect(websiteBox).not.toBeNull();
  expect(openingBox).not.toBeNull();
  expect(triggerBox).not.toBeNull();
  expect(addressBox!.height).toBeGreaterThanOrEqual(44);
  expect(websiteBox!.height).toBeGreaterThanOrEqual(44);
  expect(openingBox!.height).toBeGreaterThanOrEqual(44);
  expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(websiteBox!.y - openingBox!.y)).toBeLessThanOrEqual(1);
  expect(compactBox!.y).toBeGreaterThanOrEqual(addressBox!.y + addressBox!.height - 1);
  await expectNoHorizontalOverflow(page, "Kompakt platsinformation i exempelgruppen");

  await trigger.click();
  const sheet = page.getByTestId("place-info-check-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Kontrollera uppgifter" })).toBeVisible();
  await expect(sheet.getByText("Adress och kartposition", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Webbplats", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Öppettider", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Ny uppgift finns", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Uppgiftskontroll i exempelgruppen");

  await sheet.getByRole("button", { name: "Använd ny adress" }).click();
  await expect(
    page.getByRole("link", { name: /Öppna Gröna Terrassen i Google Maps/ }),
  ).toContainText("Utsiktsgränd 25");
  await expect(page.getByTestId("place-info-status-dot")).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
