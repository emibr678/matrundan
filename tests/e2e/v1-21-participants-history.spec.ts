import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `${context} ska inte ha horisontell overflow`).toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

test.use({ viewport: { width: 360, height: 800 } });

test("exempelgruppen visar personlig status, gäster, historik och avsiktlig karta", async ({
  page,
}) => {
  await page.goto("/exempel");

  await expect(page.getByText("Du testar gruppen som Alex, gruppens ägare.")).toBeVisible();
  await expect(page.getByText("Du har inte svarat än").first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Hem i exempelgruppen");

  await page.getByRole("button", { name: /Öppna dagsvaren för/ }).click();
  const planning = page.getByRole("dialog");
  const canButton = planning.getByRole("button", { name: "Jag kan" });
  await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");
  await expect(planning.getByText(/Kan:/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Du kan", { exact: true }).first()).toBeVisible();

  await page.goto("/matstallen/p1");
  await expect(page.getByRole("button", { name: /Föreslå som nästa stopp/ })).toBeVisible();
  await page.getByRole("button", { name: "Registrera besök" }).click();

  await expect(
    page.getByText(
      "Du registrerar besöket och räknas därför som deltagare. Välj vilka andra som var med.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Alex är deltagare eftersom du registrerar besöket",
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Lägg till gäst" }).click();
  await page.getByLabel("Gästens namn").fill("Maja");
  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  await expect(page.getByText("Maja")).toBeVisible();

  await page.getByRole("button", { name: "Helhetsbetyg: 5 av 5" }).click();
  await page.getByRole("button", { name: "Spara besök" }).click();
  await expect(page.getByText("Besök registrerat")).toBeVisible();

  await page.goto("/besok");
  await expect(page.getByRole("heading", { name: "Alla besök" })).toBeVisible();
  await expect(page.getByText("Maja · Gäst")).toBeVisible();
  await expectNoHorizontalOverflow(page, "besökshistoriken");

  await page
    .getByRole("button", { name: /Öppna besöket på Rundans Bistro/ })
    .first()
    .click();
  const visitDialog = page.getByRole("dialog");
  await expect(visitDialog.getByText("Maja", { exact: true })).toBeVisible();
  await expect(visitDialog.getByTitle("Gäst på detta besök")).toBeVisible();
  await expect(
    visitDialog.getByText("Gäster hör bara till detta besök och får ingen medlemsprogression."),
  ).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Jag var inte med" })).toHaveCount(0);
  await visitDialog.getByRole("button", { name: "Stäng", exact: true }).click();

  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Karta" }).click();
  await expect(page.locator('[data-map-renderer="example-static"]')).toBeVisible();
  await expect(
    page.getByText(
      "Exempelgruppen använder fiktiva ställen. I riktiga grupper visas den vanliga kartbakgrunden här.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Kartan kunde inte/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "exempelgruppens demokarta");
});
