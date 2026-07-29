import { expect, test } from "@playwright/test";

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

test("gruppen föreslår, svarar och bekräftar datum för nästa stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?demo=1");

  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    window.localStorage.removeItem("matrundan.nextStopDate.v1.g1");
  });
  await page.reload();

  await expect(page.getByRole("heading", { name: "Glöd & Grönska" })).toBeVisible();
  await page.getByRole("button", { name: "Föreslå datum" }).click();

  const dialog = page.getByRole("dialog", { name: "Föreslå datum" });
  await dialog.getByLabel("Datum").fill(futureDate(10));
  await dialog.getByLabel("Tid (valfritt)").fill("18:30");
  await dialog.getByRole("button", { name: "Föreslå", exact: true }).click();

  await expect(page.getByText("Ingen har svarat än", { exact: true })).toBeVisible();
  await expect(page.getByText("kl. 18:30")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ta bort förslaget" })).toHaveCount(0);

  await page.getByRole("button", { name: /Öppna datumplaneringen/ }).click();
  const planning = page.getByRole("dialog", { name: "Planera nästa stopp" });
  await expect(planning).toBeVisible();
  const planningWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(planningWidths.scroll).toBeLessThanOrEqual(planningWidths.client);
  await planning.getByRole("button", { name: "Passar 0", exact: true }).click();
  await expect(planning.getByRole("button", { name: "Passar 1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await planning.getByRole("button", { name: "Bekräfta datum" }).click();
  await expect(planning.getByText("Bekräftat", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Bekräftat", { exact: true })).toBeVisible();
  await expect(page.getByText("kl. 18:30")).toBeVisible();

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);

  await page.getByRole("button", { name: /Öppna datumplaneringen/ }).click();
  await page
    .getByRole("dialog", { name: "Planera nästa stopp" })
    .getByRole("button", { name: "Ta bort datumet" })
    .click();
  await expect(page.getByRole("button", { name: "Föreslå datum" })).toBeVisible();
});
