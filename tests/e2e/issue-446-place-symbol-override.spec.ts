import { expect, test, type Page } from "@playwright/test";

import { resetDemoStateBeforeNavigation } from "./helpers/demo-state";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth, `${context}: får inte ha horisontell overflow`).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

test("gruppen kan välja och återställa matställets symbol från detaljsidan", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemoStateBeforeNavigation(page);
  await page.goto("/matstallen/p1?demo=1");

  const symbolButton = page.getByRole("button", {
    name: "Ändra symbol för Lilla Myntans Matrum",
  });
  await expect(symbolButton).toBeVisible();
  await expect(symbolButton).toContainText("🌿");

  await symbolButton.click();
  let dialog = page.getByRole("dialog", { name: "Välj symbol" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Automatisk", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Symbolväljaren");

  await dialog.getByRole("button", { name: "Pizza" }).click();
  await dialog.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(symbolButton).toContainText("🍕");

  let storedOverride = await page.evaluate(() => {
    const raw = window.localStorage.getItem("matrundan.state.v1");
    if (!raw) return undefined;
    const state = JSON.parse(raw) as {
      places?: Array<{ id: string; symbolOverride?: string | null }>;
    };
    return state.places?.find((place) => place.id === "p1")?.symbolOverride;
  });
  expect(storedOverride).toBe("🍕");

  await symbolButton.click();
  dialog = page.getByRole("dialog", { name: "Välj symbol" });
  await dialog.getByRole("button", { name: /Automatisk/ }).click();
  await dialog.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(symbolButton).toContainText("🌿");

  storedOverride = await page.evaluate(() => {
    const raw = window.localStorage.getItem("matrundan.state.v1");
    if (!raw) return undefined;
    const state = JSON.parse(raw) as {
      places?: Array<{ id: string; symbolOverride?: string | null }>;
    };
    return state.places?.find((place) => place.id === "p1")?.symbolOverride;
  });
  expect(storedOverride).toBeNull();
});
