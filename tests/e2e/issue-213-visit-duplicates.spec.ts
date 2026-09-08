import { expect, test, type Page } from "@playwright/test";

function demoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(metrics.scroll, `${context}: ingen horisontell overflow`).toBeLessThanOrEqual(
    metrics.client,
  );
}

async function openKnownDuplicate(page: Page) {
  await page.goto("/matstallen/p2?demo=1");
  await page.evaluate(() => {
    localStorage.removeItem("matrundan.state.v1");
    sessionStorage.clear();
  });
  await page.goto("/matstallen/p2?demo=1");

  await page.getByRole("button", { name: "Registrera besök" }).first().click();
  const visitDialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(visitDialog).toBeVisible();
  await visitDialog.getByLabel("Datum").fill(demoDateDaysAgo(5));
  await visitDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Fika" }).click();
  await visitDialog.getByRole("button", { name: "4 av 5" }).click();
  await visitDialog.getByRole("button", { name: "Spara besök" }).click();

  const duplicatePrompt = page.getByRole("alertdialog", {
    name: "Det här besöket verkar redan finnas",
  });
  await expect(duplicatePrompt).toBeVisible();
  return { visitDialog, duplicatePrompt };
}

test("dubblettprompten återanvänder samma demobesök på 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { duplicatePrompt } = await openKnownDuplicate(page);

  await expect(duplicatePrompt).toContainText("Du har redan ett besök");
  await expect(duplicatePrompt.getByRole("button", { name: "Det var ett annat besök" })).toBeVisible();
  await expect(
    duplicatePrompt.getByRole("button", { name: "Öppna och komplettera besöket" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Dubblettprompt 360 px");

  await duplicatePrompt.getByRole("button", { name: "Öppna och komplettera besöket" }).click();
  await expect(page).toHaveURL(/\/matstallen\/p2\?.*visit=v1/);
});

test("ett uttryckligen separat besök kan registreras från dubblettprompten på desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { visitDialog, duplicatePrompt } = await openKnownDuplicate(page);

  await duplicatePrompt.getByRole("button", { name: "Avbryt" }).click();
  await expect(duplicatePrompt).toBeHidden();
  await expect(visitDialog).toBeVisible();
  await expect(visitDialog.getByLabel("Datum")).toHaveValue(demoDateDaysAgo(5));

  await visitDialog.getByRole("button", { name: "Spara besök" }).click();
  await expect(duplicatePrompt).toBeVisible();
  await expectNoHorizontalOverflow(page, "Dubblettprompt desktop");
  await duplicatePrompt.getByRole("button", { name: "Det var ett annat besök" }).click();
  await expect(visitDialog).toBeHidden();
  await expect(page.getByText("Besök registrerat")).toBeVisible();
});
