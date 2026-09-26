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

test("Hem visar flera väntande omdömen högst och låter användaren välja besök", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  const attention = page.getByRole("button", { name: "Välj besök att lämna omdöme på" });
  await expect(attention).toBeVisible();
  await expect(attention).toContainText("Du har 2 besök att tycka till om");
  await expect(attention).toContainText("Senast: Tacoateljén");
  await expect(page.getByText("Du har 2 besök att tycka till om")).toHaveCount(1);
  await expectNoHorizontalOverflow(page, "Hem med flera väntande omdömen");

  await attention.click();

  const chooser = page.getByRole("dialog", { name: "Besök att tycka till om" });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("link")).toHaveCount(2);
  await expect(chooser.getByRole("link", { name: /Tacoateljén/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Öppen väljare för väntande omdömen");

  await chooser.getByRole("link", { name: /Tacoateljén/ }).click();
  await expect(page).toHaveURL(/\/besok\?visit=/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Tacoateljén" })).toBeVisible();
});
