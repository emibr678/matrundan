import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("granskningsvyn byter riktig iframeviewport och behåller dialog och navigation", async ({
  page,
}, testInfo) => {
  const response = await page.goto("/ux-granskning");
  expect(response?.status()).toBe(200);
  const iframe = page.locator("#review-app");
  const app = page.frameLocator("#review-app");
  const dimensions = () =>
    app.locator("html").evaluate(() => [window.innerWidth, window.innerHeight]);
  await expect(app.locator("main")).toBeVisible();
  await expect.poll(dimensions).toEqual([360, 800]);
  await expect(page.locator("#viewport")).toHaveText("360 × 800");
  await mkdir("visual-review/work-viewport", { recursive: true });
  await page.screenshot({
    path: `visual-review/work-viewport/review-${testInfo.project.name}.png`,
    animations: "disabled",
  });

  const toolbar = page.locator("header");
  const stage = page.locator("#stage");
  const expectSeparateToolbar = async () => {
    const header = (await toolbar.boundingBox())!;
    const surface = (await stage.boundingBox())!;
    expect(header.y).toBe(0);
    expect(surface.y).toBeGreaterThanOrEqual(header.height);
    expect(surface.height).toBeGreaterThan(500);
    await expect(
      page.getByRole("radio", { name: "Mobil 360 × 800", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("radio", { name: "Desktop 1280 × 900", exact: true }),
    ).toBeInViewport();
    await expect(page.getByRole("combobox", { name: "Startvy", exact: true })).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Logga in i appen", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  };
  await expectSeparateToolbar();
  // A short outer browser scrolls the app surface while keeping controls visible.
  await stage.press("End");
  await app
    .getByRole("link", { name: "Matställen", exact: true })
    .filter({ visible: true })
    .click();
  await app.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = app.getByRole("dialog", { name: "Lägg till matställe", exact: true });
  const search = dialog.getByRole("combobox", { name: "Sök matställen", exact: true });
  await expect(search).toBeVisible();
  await search.fill("pizza");
  await expect(search).toHaveValue("pizza");
  const documentIdentity = await app.locator("html").evaluate(() => performance.timeOrigin);
  await iframe.screenshot({
    path: "visual-review/work-viewport/mobile-dialog.png",
    animations: "disabled",
  });

  await page.getByRole("radio", { name: "Desktop 1280 × 900", exact: true }).click();
  await expect.poll(dimensions).toEqual([1280, 900]);
  await expectSeparateToolbar();
  await expect(page.locator("#viewport")).toHaveText("1280 × 900");
  await expect(dialog).toBeVisible();
  await expect(search).toHaveValue("pizza");
  expect(await app.locator("html").evaluate(() => performance.timeOrigin)).toBe(documentIdentity);
  await iframe.screenshot({
    path: "visual-review/work-viewport/desktop-dialog.png",
    animations: "disabled",
  });

  await page.getByRole("radio", { name: "Mobil 360 × 800", exact: true }).click();
  await expect.poll(dimensions).toEqual([360, 800]);
  await expect(dialog).toBeVisible();
  await expect(search).toHaveValue("pizza");
  await expectSeparateToolbar();
  await dialog.getByRole("button", { name: "Stäng", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expectSeparateToolbar();
  await stage.press("End");
  await app.getByRole("link", { name: "Gruppen", exact: true }).filter({ visible: true }).click();
  await expect.poll(() => app.locator("html").evaluate(() => location.pathname)).toBe("/gruppen");
  await page.getByRole("radio", { name: "Desktop 1280 × 900", exact: true }).click();
  await expect.poll(dimensions).toEqual([1280, 900]);
  await expectSeparateToolbar();
  await expect.poll(() => app.locator("html").evaluate(() => location.pathname)).toBe("/gruppen");
  await page.getByRole("combobox", { name: "Startvy", exact: true }).selectOption("/");
  await expect(
    app.getByRole("heading", { name: "Fortsätt till Matrundan", exact: true }),
  ).toBeVisible();
  await expect(app.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeHidden();
  await page.getByRole("combobox", { name: "Startvy", exact: true }).selectOption("/exempel");
  await expect(app.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
});
