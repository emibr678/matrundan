import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${context}: sidan får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test("Rapporterade fel är inte längre en separat grupparbetskö", async ({ page }) => {
  await page.goto("/rapporterade-fel?demo=1");

  await expect(page.getByRole("heading", { name: "Rapporterade fel", level: 1 })).toBeVisible();
  await expect(
    page.getByText("Den tidigare gruppspecifika arbetskön används inte längre."),
  ).toBeVisible();
  await expect(page.getByText(/handläggningen sker centralt i Platsunderhåll/)).toBeVisible();
  await expect(
    page.getByText(/Gruppnamn, medlemskap och historisk privat rapporttext skickas inte/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Att granska/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Skicka rättelseförslag/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "pensionerad rapportdashboard");
});
