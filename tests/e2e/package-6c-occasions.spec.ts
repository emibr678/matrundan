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

test("typer av besök väljs aktivt och förklaras konsekvent på mobil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  const leaderboard = page.getByTestId("occasion-leaderboard");
  await leaderboard.getByRole("button", { name: "Visa", exact: true }).click();
  await expect(
    leaderboard.getByRole("button", { name: "Visa topplista för Avslappnat" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(leaderboard.getByText("Månskärans Taquería", { exact: true })).toBeVisible();
  await expect(leaderboard.getByText("Kvarterets Kardemumma", { exact: true })).toHaveCount(0);
  await leaderboard.getByRole("button", { name: /Snabbt och enkelt/ }).click();
  await expect(leaderboard.getByText("Kvarterets Kardemumma", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Topplista per primärt val");

  await page.getByRole("button", { name: "Öppna filter och sortering" }).click();
  const filterSheet = page.getByRole("dialog", { name: "Filter & sortering" });
  await expect(filterSheet.getByText("Passar för", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Avslappnat", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Något extra", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Snabbt och enkelt", { exact: true })).toBeVisible();
  await expect(filterSheet.getByText("Trevlig middag", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Kategorifilter");
  await filterSheet.getByRole("button", { name: /Visa \d+/ }).click();

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });

  const suggestion = addDialog.getByRole("button", {
    name: "Visa information om Päronträdets Trattoria",
    exact: true,
  });
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  const resultDialog = page.getByRole("dialog", { name: "Lägg till i gruppen" });
  await expect(resultDialog.getByText("Päronträdets Trattoria", { exact: true })).toBeVisible();
  await expect(
    resultDialog.getByRole("link", {
      name: "Öppna Päronträdets Trattoria i Google Maps",
      exact: true,
    }),
  ).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=/);
  await expect(
    resultDialog.getByText("Valfritt – kan fyllas i efter ett besök.", { exact: true }),
  ).toBeVisible();
  await expect(
    resultDialog.getByRole("button", { name: "Lägg till i gruppen", exact: true }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page, "Platsinfo före tillägg");
  await resultDialog.getByRole("button", { name: "Tillbaka", exact: true }).click();

  await addDialog.getByRole("button", { name: "Lägg till manuellt" }).click();
  await addDialog.getByLabel("Namn").fill("Testköket");
  await addDialog.getByLabel("Adress").fill("Testgatan 1");

  const addButton = addDialog.getByRole("button", { name: "Lägg till", exact: true });
  await expect(addButton).toBeEnabled();
  await expect(
    addDialog.getByText("Välj vad stället passar bäst för för att fortsätta."),
  ).toHaveCount(0);
  await expect(
    addDialog.getByText("Valfritt – kan fyllas i efter ett besök.", { exact: true }),
  ).toBeVisible();
  await expect(addDialog.getByText("Passar bäst för", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("Avslappnat", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("Något extra", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("Trevlig middag", { exact: true })).toHaveCount(0);

  await addDialog.getByRole("button", { name: "Vad betyder Passar för?" }).click();
  const guide = page.getByRole("dialog", { name: "Så fungerar Passar för" });
  await expect(guide).toContainText("inte objektiv kvalitet");
  await expect(guide).toContainText("pizzeria");
  await expect(guide).toContainText("Passar bäst för");
  await expect(guide).toContainText("finkrog");
  await expect(guide).toContainText("lämna valet tomt");
  await expectNoHorizontalOverflow(page, "Öppen kategoriförklaring");
  await guide.getByRole("button", { name: "Stäng", exact: true }).click();
  await expect(guide).toBeHidden();

  const relaxedButton = addDialog.getByRole("button", {
    name: "Passar bäst för: Avslappnat",
    exact: true,
  });
  await relaxedButton.click();
  await expect(relaxedButton).toHaveAttribute("aria-pressed", "true");
  await relaxedButton.click();
  await expect(relaxedButton).toHaveAttribute("aria-pressed", "false");
  await expect(addButton).toBeEnabled();
  await relaxedButton.click();

  await expect(addDialog.getByText("Passar också för (valfritt)", { exact: true })).toHaveCount(0);
  await addDialog
    .getByRole("button", {
      name: "Lägg till ett alternativ till (valfritt)",
      exact: true,
    })
    .click();
  await expect(addDialog.getByText("Passar också för (valfritt)", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("Inget andra sammanhang", { exact: true })).toHaveCount(0);
  await addDialog
    .getByRole("button", { name: "Passar också för: Något extra", exact: true })
    .click();
  await expect(addButton).toBeEnabled();
  await expectNoHorizontalOverflow(page, "Manuellt tillägg med kategorier");
  await addButton.click();

  const placeLink = page.getByRole("link", { name: /Testköket/ });
  await expect(placeLink).toBeVisible();
  await placeLink.click();
  await expect(page.getByText("Avslappnat", { exact: true })).toBeVisible();
  await expect(page.getByText("Något extra", { exact: true })).toBeVisible();
  await expect(page.getByText("Passar bäst för", { exact: true })).toBeVisible();
  await expect(page.getByText("Passar också för", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vad betyder Passar för?" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Detaljsida med flera val");

  await page.getByRole("button", { name: "Hantera ställe" }).click();
  const adminDialog = page.getByRole("dialog", { name: "Hantera Testköket" });
  await expect(
    adminDialog.getByRole("button", {
      name: "Passar bäst för: Avslappnat",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    adminDialog.getByRole("button", {
      name: "Passar också för: Något extra",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(adminDialog.getByRole("button", { name: "Vad betyder Passar för?" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Administration med typer av besök");
});
