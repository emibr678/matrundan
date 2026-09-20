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

test("besöksredigering lämnar omdömet orört tills användaren väljer att ändra det", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p2?demo=1&visit=v1");

  const visitSheet = page.getByRole("dialog");
  await expect(visitSheet.getByText("4,5 / 5", { exact: true }).first()).toBeVisible();
  await expect(
    visitSheet.getByText("Kardemummabullen vann hela eftermiddagen.").first(),
  ).toBeVisible();

  await visitSheet.getByRole("button", { name: "Redigera besök" }).click();
  const edit = page.getByRole("dialog", { name: "Redigera besök" });
  await expect(edit.getByRole("button", { name: "Redigera omdöme" })).toBeVisible();
  await expect(edit.getByText("Kommentar (frivilligt)")).toHaveCount(0);

  await edit.getByLabel("Tillfälle").click();
  await page.getByRole("option", { name: "Lunch" }).click();
  await edit.getByRole("button", { name: "Spara ändringar" }).click();

  await expect(visitSheet.getByText(/Lunch/).first()).toBeVisible();
  await expect(visitSheet.getByText("4,5 / 5", { exact: true }).first()).toBeVisible();
  await expect(
    visitSheet.getByText("Kardemummabullen vann hela eftermiddagen.").first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Metadataredigerat besök");
});

test("Hämtmat döljer Atmosfär reversibelt och räknar om helhetsbetyget", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p2?demo=1&visit=v1");

  const visitSheet = page.getByRole("dialog");
  await expect(visitSheet.getByText("4,5 / 5", { exact: true }).first()).toBeVisible();

  await visitSheet.getByRole("button", { name: "Redigera besök" }).click();
  const edit = page.getByRole("dialog", { name: "Redigera besök" });
  await edit.getByRole("button", { name: "Redigera omdöme" }).click();
  await expect(edit.getByText("Atmosfär", { exact: true })).toBeVisible();
  await expect(edit.getByText("4,5 / 5", { exact: true })).toBeVisible();

  const takeaway = edit.getByRole("switch", { name: "Hämtmat" });
  await takeaway.click();
  await expect(takeaway).toBeChecked();
  await expect(edit.getByText("Atmosfär", { exact: true })).toHaveCount(0);
  await expect(edit.getByText("Atmosfär ingår inte vid Hämtmat.")).toBeVisible();
  await expect(edit.getByText("4,7 / 5", { exact: true })).toBeVisible();

  await edit.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(visitSheet.getByText(/Hämtmat/).first()).toBeVisible();
  await expect(visitSheet.getByText("4,7 / 5", { exact: true }).first()).toBeVisible();
  await expect(visitSheet.getByText("Atmosfär", { exact: true })).toHaveCount(0);

  await visitSheet.getByRole("button", { name: "Redigera besök" }).click();
  const restore = page.getByRole("dialog", { name: "Redigera besök" });
  const restoreTakeaway = restore.getByRole("switch", { name: "Hämtmat" });
  await expect(restoreTakeaway).toBeChecked();
  await restoreTakeaway.click();
  await expect(restoreTakeaway).not.toBeChecked();
  await expect(restore.getByText("4,5 / 5", { exact: true })).toBeVisible();
  await restore.getByRole("button", { name: "Redigera omdöme" }).click();
  await expect(restore.getByText("Atmosfär", { exact: true })).toBeVisible();
  await restore.getByRole("button", { name: "Spara ändringar" }).click();

  await expect(visitSheet.getByText("4,5 / 5", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Reversibel Hämtmat-korrigering");
});

test("registreraren kan korrigera besök, deltagare och eget omdöme på 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p2?demo=1&visit=v1");

  const visitSheet = page.getByRole("dialog");
  await visitSheet.getByRole("button", { name: "Redigera besök" }).click();

  const edit = page.getByRole("dialog", { name: "Redigera besök" });
  await expect(edit).toBeVisible();
  await expectNoHorizontalOverflow(page, "Redigera besök");
  await expect(edit.getByText("4,5 / 5", { exact: true })).toBeVisible();
  await expect(edit.getByText("Kommentar (frivilligt)")).toHaveCount(0);

  await edit.getByLabel("Tillfälle").click();
  await page.getByRole("option", { name: "Lunch" }).click();
  await edit.getByRole("button", { name: /Johan/ }).click();
  await edit.getByRole("button", { name: "Redigera omdöme" }).click();
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
  await page.getByRole("option", { name: "Ett glas" }).click();
  await expect(contextEdit.getByText("Omdömet bevaras")).toBeVisible();
  await contextEdit.getByRole("button", { name: "Spara ändringar" }).click();

  await expect(visitSheet.getByText(/Ett glas/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Korrigerat dryckesbesök");
});

test("en annan deltagare får inte den kombinerade besökseditorn", async ({ page }) => {
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p3?demo=1&visit=v2");

  const visitSheet = page.getByRole("dialog");
  await expect(visitSheet.getByRole("heading", { name: "Månskärans Taquería" })).toBeVisible();
  await expect(visitSheet.getByRole("button", { name: "Redigera besök" })).toHaveCount(0);
});
