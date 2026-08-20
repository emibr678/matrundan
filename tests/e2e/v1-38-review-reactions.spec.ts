import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, locator: Locator, context: string) {
  const pageOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(pageOverflow.scrollWidth, `${context}: sidan ska inte overflowa`).toBeLessThanOrEqual(
    pageOverflow.clientWidth + 1,
  );

  const localOverflow = await locator.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(
    localOverflow.scrollWidth,
    `${context}: komponenten ska inte overflowa`,
  ).toBeLessThanOrEqual(localOverflow.clientWidth + 1);
}

test.use({ viewport: { width: 360, height: 800 } });

test("Gilla ger hjärta direkt och fler reaktioner väljs inline", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p3?visit=v2");

  const dialog = page.getByRole("dialog").first();
  const samReview = dialog.locator('[data-review-id="review-v2-sam"]');
  const reactionBar = samReview.locator('[data-review-reactions="review-v2-sam"]');
  const detailsButton = samReview.getByRole("button", { name: "Visa detaljer för Sam" });
  await expect(samReview).toBeVisible();
  await expect(samReview.getByText("Bra tempo och generösa portioner.")).toBeVisible();
  await expect(samReview.getByRole("button", { name: /Hjärta: 1 reaktion/ })).toBeVisible();
  await expect(samReview.getByRole("button", { name: /Ser gott ut: 1 reaktion/ })).toBeVisible();
  await expect(samReview.getByRole("button", { name: /Roligt:/ })).toHaveCount(0);
  await expect(samReview.getByText("Robin", { exact: true })).toHaveCount(0);

  const reactionBox = await reactionBar.boundingBox();
  const detailsBox = await detailsButton.boundingBox();
  expect(reactionBox).not.toBeNull();
  expect(detailsBox).not.toBeNull();
  expect(reactionBox!.y, "reaktionerna ska ligga före Detaljer").toBeLessThan(detailsBox!.y);

  const likeButton = samReview.getByRole("button", { name: "Gilla Sams omdöme" });
  await expect(likeButton).toHaveText("Gilla");
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await likeButton.click();

  let updatedSamReview = page
    .getByRole("dialog")
    .first()
    .locator('[data-review-id="review-v2-sam"]');
  await expect(
    updatedSamReview.getByRole("button", { name: /Hjärta: 2 reaktioner/ }),
  ).toBeVisible();
  await expect(updatedSamReview.getByRole("button", { name: /Ser gott ut:/ })).toHaveCount(0);

  const removeLike = updatedSamReview.getByRole("button", {
    name: "Ta bort gilla-markering från Sams omdöme",
  });
  await expect(removeLike).toHaveAttribute("aria-pressed", "true");
  await removeLike.click();
  updatedSamReview = page.getByRole("dialog").first().locator('[data-review-id="review-v2-sam"]');
  await expect(updatedSamReview.getByRole("button", { name: /Hjärta: 1 reaktion/ })).toBeVisible();

  await updatedSamReview.getByRole("button", { name: "Fler reaktioner på Sams omdöme" }).click();
  const picker = updatedSamReview.getByRole("group", { name: "Välj reaktion" });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-reaction-picker", "inline");

  const pickerBox = await picker.boundingBox();
  const reviewBox = await updatedSamReview.boundingBox();
  expect(pickerBox).not.toBeNull();
  expect(reviewBox).not.toBeNull();
  expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(
    reviewBox!.y + reviewBox!.height + 1,
  );

  await picker.getByRole("button", { name: "Roligt" }).click();
  updatedSamReview = page.getByRole("dialog").first().locator('[data-review-id="review-v2-sam"]');
  await expect(updatedSamReview.getByRole("button", { name: /Roligt: 1 reaktion/ })).toBeVisible();

  await updatedSamReview.getByRole("button", { name: "Fler reaktioner på Sams omdöme" }).click();
  await updatedSamReview
    .getByRole("group", { name: "Välj reaktion" })
    .getByRole("button", { name: /^Roligt, vald/ })
    .click();
  await expect(updatedSamReview.getByRole("button", { name: /Roligt:/ })).toHaveCount(0);

  const heartChip = updatedSamReview.getByRole("button", { name: /Hjärta: 1 reaktion/ });
  await heartChip.click();
  await expect(page.getByText("Robin", { exact: true })).toBeVisible();

  await expectNoHorizontalOverflow(page, dialog, "reaktionsflöde på 360 px");
});

test("Hem fokuserar senaste omdömet utan scrollhopp vid Gilla", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();

  const latestReviewLink = page.getByRole("link", {
    name: "Öppna omdömet från Robin om Kardemummaköket",
  });
  await expect(latestReviewLink).toBeVisible();
  await expect(latestReviewLink.getByText("Robin", { exact: true })).toBeVisible();
  await expect(
    latestReviewLink.getByText(
      "”Kardemummabullen var värd omvägen – fortfarande varm när vi fick den.”",
      { exact: true },
    ),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, latestReviewLink, "senaste omdömet på Hem");

  await latestReviewLink.click();

  const dialog = page.getByRole("dialog").first();
  const focusedReview = dialog.locator('[data-review-id="review-v1-robin"]');
  await expect(focusedReview).toBeVisible();
  await expect(focusedReview).toHaveAttribute("data-review-highlighted", "true");
  await expect(focusedReview.getByRole("button", { name: "Gilla Robins omdöme" })).toBeVisible();
  await expect(
    focusedReview.getByRole("button", { name: "Fler reaktioner på Robins omdöme" }),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const dialogBox = await dialog.boundingBox();
      const focusedBox = await focusedReview.boundingBox();
      if (!dialogBox || !focusedBox) return -1;
      return focusedBox.y - dialogBox.y;
    })
    .toBeGreaterThanOrEqual(40);
  await expect
    .poll(async () => {
      const dialogBox = await dialog.boundingBox();
      const focusedBox = await focusedReview.boundingBox();
      if (!dialogBox || !focusedBox) return 999;
      return focusedBox.y - dialogBox.y;
    })
    .toBeLessThan(220);

  await expect(focusedReview).not.toHaveAttribute("data-review-highlighted", "true", {
    timeout: 4_000,
  });

  const scrollTopBeforeLike = await dialog.evaluate((element) => element.scrollTop);
  await focusedReview.getByRole("button", { name: "Gilla Robins omdöme" }).click();
  await expect(focusedReview.getByRole("button", { name: /Hjärta: 1 reaktion/ })).toBeVisible();
  await expect(focusedReview).not.toHaveAttribute("data-review-highlighted", "true");
  await expect
    .poll(async () => {
      const scrollTopAfterLike = await dialog.evaluate((element) => element.scrollTop);
      return Math.abs(scrollTopAfterLike - scrollTopBeforeLike);
    })
    .toBeLessThanOrEqual(2);
});

test("deep-linkat omdöme öppnas synligt i samma besöksdetalj", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/besok?visit=v2&review=review-v2-sam");

  const dialog = page.getByRole("dialog").first();
  const focusedReview = dialog.locator('[data-review-id="review-v2-sam"]');
  await expect(focusedReview).toBeVisible();
  await expect(focusedReview).toHaveAttribute("data-review-highlighted", "true");
  await expect(focusedReview.getByRole("button", { name: "Gilla Sams omdöme" })).toBeVisible();
  await expect(
    focusedReview.getByRole("button", { name: "Fler reaktioner på Sams omdöme" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, dialog, "deep-linkat omdöme på 360 px");
});

test("Gilla-raden behåller samma kompakta hierarki på desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p3?visit=v2");

  const dialog = page.getByRole("dialog").first();
  const samReview = dialog.locator('[data-review-id="review-v2-sam"]');
  await expect(samReview.getByRole("button", { name: /Hjärta: 1 reaktion/ })).toBeVisible();
  await expect(samReview.getByRole("button", { name: "Gilla Sams omdöme" })).toBeVisible();
  await expect(
    samReview.getByRole("button", { name: "Fler reaktioner på Sams omdöme" }),
  ).toBeVisible();
  await expect(samReview.getByText("Robin", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, dialog, "reaktionsflöde på desktop");
});
