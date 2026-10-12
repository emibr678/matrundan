import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { workChromiumLaunchOptions } from "./work-browser-config.ts";

const [previewUrl, expectedSha] = process.argv.slice(2);
const url = new URL(previewUrl ?? "https://invalid.invalid");
if (
  url.protocol !== "https:" ||
  !/(^|-)staging\.matrundan\.workers\.dev$/.test(url.hostname) ||
  !/^[a-f0-9]{40}$/.test(expectedSha ?? "")
) {
  throw new Error("Ange en exakt Staging-preview och dess fullständiga head-SHA.");
}
const browser = await chromium.launch(workChromiumLaunchOptions());
try {
  const page = await browser.newPage({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  const health = await page.request.get(new URL("/api/health", url).href);
  expect(health.ok()).toBe(true);
  expect((await health.json()).release).toBe(expectedSha);
  // The real bundle and tile requests, with fictional data and no live writes.
  await page.goto(new URL("/matstallen?demo=1", url).href);
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe", exact: true });
  await dialog
    .getByRole("combobox", { name: "Sök matställen", exact: true })
    .fill("Månbackens Matrum");
  await dialog.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await dialog.getByRole("button", { name: "Karta", exact: true }).click();
  const map = dialog.getByRole("region", {
    name: "Karta över sökresultat och valda sökområden",
    exact: true,
  });
  // ready requires rendered features in an external base layer, not just load.
  await expect(map).toHaveAttribute("data-map-tile-status", "ready", { timeout: 30000 });
  await expect(map).toHaveAttribute("data-map-ready", "true");
  await expect(map.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  await mkdir("visual-review", { recursive: true });
  await map.screenshot({ path: "visual-review/live-preview-map.png" });
  console.log(`Verifierad extern kartbakgrund: ${url.origin} · ${expectedSha}`);
} finally {
  await browser.close();
}
