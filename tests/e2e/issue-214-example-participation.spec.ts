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

test("exempelgruppen bevarar svar och låter medlemmen lägga till sig själv", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9");
  let visitDialog = page.getByRole("dialog").first();
  let prompt = visitDialog.getByLabel("Bekräfta deltagande");
  await expect(prompt).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);

  await prompt.getByRole("button", { name: "Inte nu" }).click();
  await expect(visitDialog.getByLabel("Deltagandeförslag väntar på svar")).toBeVisible();

  await page.reload();
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
  const addParticipantButton = visitDialog.getByRole("button", { name: "Lägg till deltagare" });
  await expect(addParticipantButton).toBeVisible();

  await page.reload();
  visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByLabel("Bekräfta deltagande")).toHaveCount(0);
  await expect(visitDialog.getByLabel("Deltagandeförslag väntar på svar")).toHaveCount(0);
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "exempelgruppens avvisade deltagandeförslag");

  await visitDialog.getByRole("button", { name: "Lägg till deltagare" }).click();
  const participantDialog = page.getByRole("dialog", { name: "Lägg till deltagare" });
  await expect(participantDialog).toBeVisible();
  await expect(participantDialog.getByText("Var du själv med?", { exact: true })).toBeVisible();
  await expect(participantDialog.getByRole("button", { name: "Ja, lägg till mig" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "egen deltagarbekräftelse i exempelgruppen");

  await participantDialog.getByRole("button", { name: "Ja, lägg till mig" }).click();
  await expect(page.getByText("Du är tillagd som deltagare.", { exact: true })).toBeVisible();
  await expect(participantDialog).toBeHidden();
  await expect(page.getByTitle("Personer utanför den här gruppen visas anonymt.")).toContainText(
    "+1 utanför gruppen",
  );

  await page.goto("/exempel");
  await page.getByRole("button", { name: "Återställ" }).click();
  await expect(page.getByText("Exempelgruppen är återställd.", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9");
  visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByLabel("Bekräfta deltagande")).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "återställd exempelgrupp med deltagandefråga");
});
