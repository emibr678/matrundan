import { expect, test } from "@playwright/test";

const STAGING = process.env.MATRUNDAN_ENVIRONMENT === "staging";

test("miljöidentiteten följer byggmiljön på mobil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(STAGING ? "/" : "/?demo=1", { waitUntil: "domcontentloaded" });

  const environmentButton = page.getByRole("button", {
    name: "Visa information om stagingmiljön",
  });
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");

  if (!STAGING) {
    await expect(environmentButton).toHaveCount(0);
    await expect(page).toHaveTitle("Hem · Matrundan");
    expect(manifestHref).toBe("/manifest.webmanifest");
    return;
  }

  await expect(environmentButton).toBeVisible();
  await expect(page).toHaveTitle("Hem · Matrundan Staging");
  expect(manifestHref).toBe("/manifest-staging.webmanifest");

  // Verify the same marker in the group shell after checking the signed-out landing page.
  await page.goto("/?demo=1", { waitUntil: "domcontentloaded" });
  await expect(environmentButton).toBeVisible();

  await environmentButton.click();
  await expect(page.getByRole("heading", { name: "Miljöinformation" })).toBeVisible();
  await expect(page.getByText("b34cde4", { exact: true })).toBeVisible();
  await expect(page.getByText(/13 sep\. 2026/)).toBeVisible();

  const stagingManifest = await page.evaluate(async () => {
    const response = await fetch("/manifest-staging.webmanifest");
    return response.json() as Promise<{ name: string; short_name: string }>;
  });
  expect(stagingManifest).toMatchObject({
    name: "Matrundan Staging",
    short_name: "Matrundan STG",
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  if (process.env.VISUAL_REVIEW_CAPTURE === "1") {
    await page.screenshot({
      path: "visual-review/issue-329-staging-info-mobile.png",
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Kopiera miljöinfo" }).click();
  await expect(page.getByText("Miljöinformationen är kopierad.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Miljöinformation" })).toBeHidden();
});
