import { expect, test, type Locator, type Page } from "@playwright/test";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAwMAAAAYAAeIhvDMAAAAASUVORK5CYII=",
  "base64",
);

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `${context} ska inte ha horisontell overflow`).toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

async function expectNoLocatorOverflow(locator: Locator, context: string) {
  const overflow = await locator.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth, `${context} ska inte ha horisontell overflow`).toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

test.use({ viewport: { width: 360, height: 800 } });

test("exempelgruppen samlar 3+ deltagaromdömen och låter Alex komplettera samma besök", async ({
  page,
}) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p3?visit=v2");

  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Tacoateljén" })).toBeVisible();
  const reviewSection = visitDialog.getByLabel("Gängets omdömen");
  await expect(reviewSection).toBeVisible();
  await expect(
    reviewSection.getByText("3 av 4 deltagare i gruppen har lämnat omdöme"),
  ).toBeVisible();
  await expect(
    reviewSection.locator('[data-review-id="review-v2-sam"]').getByText("Sam", { exact: true }),
  ).toBeVisible();
  await expect(
    reviewSection.locator('[data-review-id="review-v2-kim"]').getByText("Kim", { exact: true }),
  ).toBeVisible();
  await expect(
    reviewSection.locator('[data-review-id="review-v2-noor"]').getByText("Noor", { exact: true }),
  ).toBeVisible();
  await expect(
    reviewSection.getByText("Den här dolda kommentaren får inte visas i exempelgruppen."),
  ).toHaveCount(0);
  await expect(visitDialog.getByText("Kommentar från gänget", { exact: true })).toHaveCount(0);
  await expect(visitDialog.getByText("Din synlighet", { exact: true })).toHaveCount(0);
  await expect(reviewSection.getByRole("button", { name: "Lägg till ditt omdöme" })).toHaveCount(1);
  await expectNoLocatorOverflow(visitDialog, "Tacoateljéns besöksdetalj");
  await expectNoHorizontalOverflow(page, "Tacoateljéns besöksdetalj på 360 px");

  await reviewSection.getByRole("button", { name: "Lägg till ditt omdöme" }).click({ force: true });
  const reviewDialog = page.getByRole("dialog").last();
  await expect(reviewDialog.getByRole("heading", { name: "Ditt omdöme" })).toBeVisible();
  await expect(reviewDialog.getByText(/Helhetsbetyget räknas automatiskt/)).toBeVisible();
  await expect(reviewDialog.getByText(/komprimeras/i)).toHaveCount(0);
  for (const dimension of ["Smak", "Service", "Prisvärdhet", "Atmosfär"]) {
    await reviewDialog.getByRole("button", { name: `${dimension}: 5 av 5` }).click();
  }
  await reviewDialog.getByLabel("Kommentar (frivilligt)").fill("Mitt eget minne från kvällen.");
  await expect(reviewDialog.getByRole("button", { name: "Lägg till bild" })).toBeVisible();
  await reviewDialog.getByLabel("Välj bild från besöket").setInputFiles({
    name: "taco-minne.png",
    mimeType: "image/png",
    buffer: PNG_1PX,
  });
  await expect(reviewDialog.getByText("Ny bild vald", { exact: true })).toBeVisible();
  await expectNoLocatorOverflow(reviewDialog, "Ditt omdöme med bildfält");
  await reviewDialog.getByRole("button", { name: "Spara omdöme" }).click();

  await expect(page.getByText("Ditt omdöme och din bild är tillagda.")).toBeVisible();
  await expect(
    reviewSection.getByText("4 av 4 deltagare i gruppen har lämnat omdöme"),
  ).toBeVisible();
  await expect(reviewSection.getByRole("button", { name: "Lägg till ditt omdöme" })).toHaveCount(0);
  await expect(reviewSection.getByText("Mitt eget minne från kvällen.")).toBeVisible();
  const editReviewButton = reviewSection.getByRole("button", { name: "Redigera omdöme" });
  await expect(editReviewButton).toBeVisible();
  await expect(reviewSection.getByText("Redigera omdöme", { exact: true })).toBeVisible();

  await expect(visitDialog.getByRole("heading", { name: "Bild från besöket" })).toBeVisible();
  await expect(visitDialog.getByAltText("Bild från Alex")).toBeVisible();

  await editReviewButton.click();
  let editReviewDialog = page.getByRole("dialog", { name: "Redigera ditt omdöme" });
  await expect(editReviewDialog.getByAltText("Din bild från besöket")).toBeVisible();
  await expect(editReviewDialog.getByText("Din nuvarande bild", { exact: true })).toBeVisible();
  await expectNoLocatorOverflow(editReviewDialog, "Redigera omdöme med befintlig bild");

  await editReviewDialog.getByRole("button", { name: "Ta bort bild" }).click();
  await expect(
    editReviewDialog.getByText("Bilden tas bort när du sparar", { exact: true }),
  ).toBeVisible();
  await expect(editReviewDialog.getByRole("button", { name: "Ångra" })).toBeVisible();
  await editReviewDialog.getByRole("button", { name: "Avbryt" }).click();

  await expect(visitDialog.getByAltText("Bild från Alex")).toBeVisible();

  await editReviewButton.click();
  editReviewDialog = page.getByRole("dialog", { name: "Redigera ditt omdöme" });
  await editReviewDialog.getByRole("button", { name: "Ta bort bild" }).click();
  await editReviewDialog.getByRole("button", { name: "Spara omdöme" }).click();

  await expect(page.getByText("Ditt omdöme är uppdaterat och bilden borttagen.")).toBeVisible();
  await expect(visitDialog.getByAltText("Bild från Alex")).toHaveCount(0);
  const addPhotoButton = visitDialog.getByRole("button", { name: "Lägg till din bild" });
  await expect(addPhotoButton).toBeVisible();
  await expect(addPhotoButton).toHaveClass(/min-h-11/);
  await expect(addPhotoButton).not.toHaveClass(/min-h-24/);
  await expect(addPhotoButton).not.toHaveClass(/border-dashed/);

  await expectNoLocatorOverflow(visitDialog, "kompletterat fleromdömesscenario");
});

test("historiskt 3D-omdöme är komplett och Atmosfär läggs till först vid sparning", async ({
  page,
}) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p1?visit=v10");

  const visitDialog = page.getByRole("dialog").first();
  const reviewSection = visitDialog.getByLabel("Gängets omdömen");
  const historicalReview = reviewSection.locator('[data-review-id="review-v10-alex"]');

  await expect(historicalReview.getByText("4,7 / 5", { exact: true })).toBeVisible();
  await expect(historicalReview.getByText("Atmosfär", { exact: true })).toHaveCount(0);

  await historicalReview.getByRole("button", { name: "Redigera omdöme" }).click();
  let editDialog = page.getByRole("dialog", { name: "Redigera ditt omdöme" });

  await expect(editDialog.getByText("Äldre detaljbetyg (frivilligt)")).toHaveCount(0);
  await expect(editDialog.getByRole("button", { name: /Atmosfär:/ })).toHaveCount(0);
  await expect(editDialog.getByText("4,7 / 5", { exact: true })).toBeVisible();
  const scoreFields = editDialog.getByRole("group", { name: "Detaljbetyg" });
  await expect(scoreFields.getByText("Ingick inte i betyget när omdömet skapades.")).toBeVisible();
  await expect(scoreFields.getByRole("button", { name: "Lägg till Atmosfär" })).toBeVisible();
  await expectNoLocatorOverflow(editDialog, "historiskt 3D-omdöme");

  await scoreFields.getByRole("button", { name: "Lägg till Atmosfär" }).click();
  await expect(editDialog.getByRole("button", { name: "Atmosfär: 3 av 5" })).toBeVisible();
  await expect(
    scoreFields.getByText(
      "När du sparar läggs Atmosfär till i omdömet och helhetsbetyget räknas om.",
    ),
  ).toBeVisible();
  await editDialog.getByRole("button", { name: "Atmosfär: 3 av 5" }).click();
  await expect(editDialog.getByText("4,3 / 5", { exact: true })).toBeVisible();

  await scoreFields.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(editDialog.getByRole("button", { name: /Atmosfär:/ })).toHaveCount(0);
  await expect(editDialog.getByText("4,7 / 5", { exact: true })).toBeVisible();

  await scoreFields.getByRole("button", { name: "Lägg till Atmosfär" }).click();
  await editDialog.getByRole("button", { name: "Atmosfär: 3 av 5" }).click();
  await expectNoLocatorOverflow(editDialog, "frivillig Atmosfär-komplettering");
  await expectNoHorizontalOverflow(page, "frivillig Atmosfär-komplettering på 360 px");
  await editDialog.getByRole("button", { name: "Spara omdöme" }).click();

  const upgradeConfirmation = page.getByRole("alertdialog", { name: "Lägga till Atmosfär?" });
  await expect(upgradeConfirmation).toBeVisible();
  await expect(
    upgradeConfirmation.getByText(
      "När du sparar blir Atmosfär en permanent del av omdömet och helhetsbetyget räknas om. Du kan ändra betyget senare, men inte ta bort Atmosfär igen.",
    ),
  ).toBeVisible();
  await expectNoLocatorOverflow(upgradeConfirmation, "bekräfta modelluppgradering");
  await upgradeConfirmation.getByRole("button", { name: "Avbryt" }).click();
  await expect(editDialog).toBeVisible();
  await expect(historicalReview.getByText("4,7 / 5", { exact: true })).toBeVisible();

  await editDialog.getByRole("button", { name: "Spara omdöme" }).click();
  await page
    .getByRole("alertdialog", { name: "Lägga till Atmosfär?" })
    .getByRole("button", { name: "Lägg till och spara" })
    .click();

  await expect(page.getByText("Ditt omdöme är uppdaterat.")).toBeVisible();
  await expect(historicalReview.getByText("4,3 / 5", { exact: true })).toBeVisible();
  await expect(historicalReview.getByText("Atmosfär", { exact: true })).toBeVisible();

  await historicalReview.getByRole("button", { name: "Redigera omdöme" }).click();
  editDialog = page.getByRole("dialog", { name: "Redigera ditt omdöme" });
  await expect(editDialog.getByRole("button", { name: "Lägg till Atmosfär" })).toHaveCount(0);
  await expect(editDialog.getByRole("button", { name: "Atmosfär: 3 av 5" })).toBeVisible();
});
