import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 360, height: 800 } });

test("deltagarnas bilder behåller eget ägarskap i samma besök", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p2?visit=v1");

  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Kardemummaköket" })).toBeVisible();

  const gallery = visitDialog.getByRole("region", { name: "Bilder från besöket" });
  await expect(gallery).toBeVisible();
  await expect(gallery.getByAltText("Bild från Robin")).toBeVisible();
  await expect(gallery.getByText("Robin", { exact: true })).toBeVisible();
  await expect(gallery.getByRole("button", { name: "Byt din bild" })).toBeVisible();
  await expect(gallery.getByRole("button", { name: "Ta bort din bild" })).toBeVisible();
  await expect(
    gallery.getByRole("button", { name: "Fler bildalternativ för Robin" }),
  ).toBeVisible();

  const overflow = await visitDialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
