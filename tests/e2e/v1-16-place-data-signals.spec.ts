import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    metrics.scrollWidth,
    `${context}: dokumentet får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test("begränsad platsinformation visas först i öppnad träff och egen rapport får privat status", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(addDialog.locator('[aria-label="Begränsad platsinformation"]')).toHaveCount(0);

  await addDialog
    .getByRole("button", {
      name: "Visa information om Päronträdets Trattoria",
      exact: true,
    })
    .click();

  const resultDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  const limitedInfo = resultDialog.getByRole("button", {
    name: "Begränsad platsinformation",
    exact: true,
  });
  await expect(limitedInfo).toBeVisible();
  await expect(
    page.getByText(
      "Webbplats och öppettider saknas i kartdatan. Det säger inget om huruvida stället är öppet – kontrollera gärna Google Maps före besöket.",
      { exact: true },
    ),
  ).toHaveCount(0);

  await limitedInfo.click();
  await expect(
    page.getByText(
      "Webbplats och öppettider saknas i kartdatan. Det säger inget om huruvida stället är öppet – kontrollera gärna Google Maps före besöket.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    resultDialog.getByRole("button", { name: "Verkar fortfarande öppet", exact: true }),
  ).toHaveCount(0);
  await expect(
    resultDialog.getByRole("button", { name: "Bekräfta permanent stängt", exact: true }),
  ).toHaveCount(0);
  await expect(
    resultDialog.getByText("Rapportera till gruppens admin eller dölj träffen för gruppen.", {
      exact: true,
    }),
  ).toBeVisible();

  await resultDialog.getByRole("button", { name: /Stängt eller fel uppgifter\?/ }).click();
  const issueDialog = page.getByRole("dialog", { name: "Stängt eller fel uppgifter?" });
  await expect(
    issueDialog.getByRole("button", { name: /Rapportera felaktiga uppgifter/ }),
  ).toBeVisible();
  await expect(
    issueDialog.getByRole("button", { name: /Dölj från gruppens sökningar/ }),
  ).toBeVisible();

  await issueDialog.getByRole("button", { name: /Rapportera felaktiga uppgifter/ }).click();
  const reportDialog = page.getByRole("dialog", { name: "Rapportera felaktiga uppgifter" });
  await reportDialog.getByLabel("Dölj även träffen för gruppen").uncheck();
  await reportDialog
    .getByLabel("Vad har du sett?")
    .fill("Restaurangen har stängt permanent och lokalen står tom.");
  await reportDialog.getByRole("button", { name: "Skicka rapport" }).click();
  await expect(reportDialog).toBeHidden();

  await resultDialog.getByRole("button", { name: "Tillbaka", exact: true }).click();
  await expect(addDialog).toBeVisible();
  await expect(
    addDialog.getByText("Din rapport väntar på granskning", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Kompakt platsinformation och privat rapportstatus");
});
