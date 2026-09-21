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
  const robinPhoto = gallery.getByRole("group", { name: "Bild från Robin" });
  await expect(robinPhoto.getByAltText("Bild från Robin")).toBeVisible();
  await expect(robinPhoto.getByText("Robin", { exact: true })).toBeVisible();
  await expect(robinPhoto.getByRole("button", { name: "Byt bild" })).toHaveCount(0);
  await expect(
    robinPhoto.getByRole("button", { name: "Fler bildalternativ för Robin" }),
  ).toBeVisible();
  await robinPhoto.getByRole("button", { name: "Fler bildalternativ för Robin" }).click();
  await page.getByRole("menuitem", { name: "Ta bort bild" }).click();
  const deleteRobinPhoto = page.getByRole("alertdialog");
  await expect(
    deleteRobinPhoto.getByRole("heading", { name: "Ta bort Robins bild?" }),
  ).toBeVisible();
  await expect(deleteRobinPhoto).toContainText(
    "Du tar bort en bild som Robin har lagt till. Bilden försvinner från besöket för hela gruppen och det går inte att ångra.",
  );
  await deleteRobinPhoto.getByRole("button", { name: "Avbryt" }).click();

  const alexPhoto = gallery.getByRole("group", { name: "Bild från Alex, din bild" });
  await expect(alexPhoto.getByRole("button", { name: "Byt bild" })).toHaveCount(0);
  await alexPhoto.getByRole("button", { name: "Fler alternativ för din bild" }).click();
  await expect(page.getByRole("menuitem", { name: "Byt bild" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Ta bort din bild" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gallery.getByText(/Svep mellan deltagarnas bilder/)).toHaveCount(0);

  const overflow = await visitDialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
