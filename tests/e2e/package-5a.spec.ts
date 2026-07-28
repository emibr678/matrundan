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

test("utloggad användare möts av landningssidan i stället för en fiktiv grupp", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Hitta nästa ställe – och minns rundorna tillsammans." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Skapa en grupp" })).toBeVisible();
  await expect(page.getByLabel("Inbjudningslänk eller kod")).toBeVisible();
  await expect(page.getByRole("link", { name: /Öppna exempelgruppen/ })).toBeVisible();
  await expect(page.getByText("Fredagsgänget", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Landningssidan på 360 px");
});

test("Fredagsgänget är ett tydligt skrivskyddat Stockholmsexempel", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "matrundan.state.v1",
      JSON.stringify({ group: { name: "Gammal lokal demo" } }),
    );
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");

  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await expect(page.getByText(/Fredagsgänget är fiktivt och skrivskyddat/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hermans" })).toBeVisible();
  await expect(page.getByText("Föreslaget av 🐻 Sam", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lägg till ställe" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Slumpa" })).toHaveCount(0);
  await expect(page.getByText("Gammal lokal demo")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Exempelgruppen på 360 px");

  await page.getByRole("link", { name: "Matställen" }).click();
  await expect(page.getByRole("heading", { name: "Pelikan", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Café Pascal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /favorit/i })).toHaveCount(0);
  await expect(page.getByText("Göteborg", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Exempelgruppens matställeslista på 360 px");
});

test("den interna demosandboxen är fortsatt skrivbar för regressionstester", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?demo=1");

  await expect(page.getByRole("button", { name: "Lägg till ställe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" })).toBeVisible();
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Intern demosandbox på 360 px");
});
