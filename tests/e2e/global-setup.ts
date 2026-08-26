import { chromium, expect } from "@playwright/test";

export default async function globalSetup() {
  if (!process.env.CI) return;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });

  try {
    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header [data-matrundan-brand='lockup']").first()).toBeVisible({
      timeout: 45_000,
    });
  } finally {
    await browser.close();
  }
}
