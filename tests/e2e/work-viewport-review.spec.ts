import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("granskningsvyn byter riktig iframeviewport och behåller dialog och navigation", async ({
  page,
}) => {
  await page.goto("/ux-granskning");
  const iframe = page.locator("#review-app");
  const app = page.frameLocator("#review-app");
  const dimensions = () =>
    app.locator("html").evaluate(() => [window.innerWidth, window.innerHeight]);
  await expect(app.locator("main")).toBeVisible();
  await expect.poll(dimensions).toEqual([360, 800]);
  await expect(page.locator("#viewport")).toHaveText("360 × 800");

  // The fixed 800px app extends below the review toolbar; scroll the outer page
  // just as a reviewer would before using the app's bottom navigation.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
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
  await mkdir("visual-review/work-viewport", { recursive: true });
  await iframe.screenshot({
    path: "visual-review/work-viewport/mobile-dialog.png",
    animations: "disabled",
  });

  await page.getByRole("radio", { name: "Desktop 1280 × 900", exact: true }).check();
  await expect.poll(dimensions).toEqual([1280, 900]);
  await expect(page.locator("#viewport")).toHaveText("1280 × 900");
  await expect(dialog).toBeVisible();
  await expect(search).toHaveValue("pizza");
  expect(await app.locator("html").evaluate(() => performance.timeOrigin)).toBe(documentIdentity);
  await iframe.screenshot({
    path: "visual-review/work-viewport/desktop-dialog.png",
    animations: "disabled",
  });

  await page.getByRole("radio", { name: "Mobil 360 × 800", exact: true }).check();
  await expect.poll(dimensions).toEqual([360, 800]);
  await expect(dialog).toBeVisible();
  await expect(search).toHaveValue("pizza");
  await dialog.getByRole("button", { name: "Stäng", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await app.getByRole("link", { name: "Gruppen", exact: true }).filter({ visible: true }).click();
  await expect.poll(() => app.locator("html").evaluate(() => location.pathname)).toBe("/gruppen");
  await page.getByRole("radio", { name: "Desktop 1280 × 900", exact: true }).check();
  await expect.poll(dimensions).toEqual([1280, 900]);
  await expect.poll(() => app.locator("html").evaluate(() => location.pathname)).toBe("/gruppen");
});
