import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth, `${context} ska sakna horisontell overflow`).toBeLessThanOrEqual(
    widths.clientWidth + 1,
  );
}

async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test("exempelgruppen bevarar svar på ett mottaget deltagandeförslag", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9");
  await disableMotion(page);
  let visitDialog = page.getByRole("dialog").first();
  let prompt = visitDialog.getByLabel("Bekräfta deltagande");
  await expect(prompt).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);

  await prompt.getByRole("button", { name: "Inte nu" }).click();
  await expect(visitDialog.getByLabel("Deltagandeförslag väntar på svar")).toBeVisible();

  await page.reload();
  await disableMotion(page);
  visitDialog = page.getByRole("dialog").first();
  const deferred = visitDialog.getByLabel("Deltagandeförslag väntar på svar");
  await expect(deferred).toBeVisible();
  await expect(deferred.getByText("Du svarar senare", { exact: true })).toBeVisible();
  await expect(deferred.getByText("Frågan finns kvar här.", { exact: true })).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);

  await deferred.getByRole("button", { name: "Svara nu" }).click();
  prompt = visitDialog.getByLabel("Bekräfta deltagande");
  await prompt.getByRole("button", { name: "Jag var inte med" }).click();
  await expect(prompt).toBeHidden();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);

  await page.reload();
  await disableMotion(page);
  visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByLabel("Bekräfta deltagande")).toHaveCount(0);
  await expect(visitDialog.getByLabel("Deltagandeförslag väntar på svar")).toHaveCount(0);
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "exempelgruppens avvisade deltagandeförslag");

  await page.goto("/exempel");
  await page.getByRole("button", { name: "Återställ" }).click();
  await expect(page.getByText("Exempelgruppen är återställd.", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9");
  await disableMotion(page);
  visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByLabel("Bekräfta deltagande")).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "återställd exempelgrupp med deltagandefråga");
});
