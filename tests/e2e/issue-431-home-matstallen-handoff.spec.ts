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

test("Hem lämnar samla-flödet till Matställen på mobil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await page.goto("/?demo=1");
  await expect(page.getByRole("button", { name: "Lägg till ställe", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bläddra listan", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Renodlat Hem");

  await page.evaluate(() => {
    const stateKey = "matrundan.state.v1";
    const raw = window.localStorage.getItem(stateKey);
    if (!raw) throw new Error("Demosandboxens state saknas.");

    const state = JSON.parse(raw) as {
      group: { id: string };
      places: unknown[];
      visits: unknown[];
      favorites: unknown[];
      activity: unknown[];
    };
    state.places = [];
    state.visits = [];
    state.favorites = [];
    state.activity = [];
    window.localStorage.setItem(stateKey, JSON.stringify(state));
    window.localStorage.removeItem(`matrundan.nextStop.v2.${state.group.id}`);
    window.localStorage.removeItem(`matrundan.nextStop.v2.responses.${state.group.id}`);
  });
  await page.reload();

  await expect(page.getByRole("heading", { name: "Börja med ett ställe" })).toBeVisible();
  const addFirst = page.getByRole("link", { name: "Lägg till första stället", exact: true });
  await expect(addFirst).toBeVisible();
  await addFirst.click();

  await expect(page).toHaveURL(/\/matstallen/);
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(addDialog).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has("add")).toBe(false);
  await expectNoHorizontalOverflow(page, "Matställen med lägg-till-dialog");

  await page.keyboard.press("Escape");
  await expect(addDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till ställe", exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Börja med ett ställe" })).toBeVisible();
});

test("Hem saknar parallella samla-genvägar på desktop och i exempelgruppen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/?demo=1");
  await expect(page.getByRole("button", { name: "Lägg till ställe", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bläddra listan", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Renodlat Hem på desktop");

  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till ställe", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bläddra listan", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Exempelgruppens Hem på desktop");
});
