import { expect, test, type Page } from "@playwright/test";

import { resetDemoStateBeforeNavigation } from "./helpers/demo-state";

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

test("registreraren kan korrigera besök, deltagare och eget omdöme på 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p2?demo=1&visit=v1");

  const visitSheet = page.getByRole("dialog");
  await visitSheet.getByRole("button", { name: "Redigera besök" }).click();

  const edit = page.getByRole("dialog", { name: "Redigera besök" });
  await expect(edit).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redigera besök");
  await expect(edit.getByText("Atmosfär ingår.")).toBeVisible();
  await expect(edit.getByText("Kommentar (frivilligt)")).toHaveCount(0);

  await edit.getByLabel("Tillfälle").click();
  await page.getByRole("option", { name: "Lunch" }).click();
  await edit.getByRole("button", { name: /Johan/ }).click();
  await edit.getByRole("button", { name: "Ändra även omdömet" }).click();
  await expect(edit.getByText("Atmosfär", { exact: true })).toBeVisible();
  await expect(edit.getByText("Räknas automatiskt")).toBeVisible();
  await edit.getByLabel("Kommentar (frivilligt)").fill("Korrigerad minnesnotering från besöket.");
  await edit.getByRole("button", { name: "Spara ändringar" }).click();

  await expect(visitSheet.getByText(/Lunch/).first()).toBeVisible();
  await expect(visitSheet.getByText(/Johan/).first()).toBeVisible();
  await expect(
    visitSheet.getByText("Korrigerad minnesnotering från besöket.").first(),
  ).toBeVisible();

  await visitSheet.getByRole("button", { name: "Redigera besök" }).click();
  const contextEdit = page.getByRole("dialog", { name: "Redigera besök" });
  await contextEdit.getByLabel("Tillfälle").click();
  await page.getByRole("option", { name: "Något att dricka" }).click();
  await expect(contextEdit.getByText("Omdömet bevaras")).toBeVisible();
  await contextEdit.getByRole("button", { name: "Spara ändringar" }).click();

  await expect(visitSheet.getByText(/Något att dricka/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Korrigerat dryckesbesök");
});

test("en annan deltagare får inte den kombinerade besökseditorn", async ({ page }) => {
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p3?demo=1&visit=v2");

  const visitSheet = page.getByRole("dialog");
  await expect(visitSheet.getByRole("heading", { name: "Månskärans Taquería" })).toBeVisible();
  await expect(visitSheet.getByRole("button", { name: "Redigera besök" })).toHaveCount(0);
});
