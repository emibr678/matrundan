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

test("Reagera samlar valet och gör den egna reaktionen enkel att ta bort", async ({ page }) => {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p3?visit=v2");

  const dialog = page.getByRole("dialog").first();
  const samReview = dialog.locator('[data-review-id="review-v2-sam"]');
  const reactionBar = samReview.locator('[data-review-reactions="review-v2-sam"]');
  await expect(samReview).toBeVisible();
  await expect(samReview.getByText("Bra tempo och generösa portioner.")).toBeVisible();

  const heartChip = samReview.getByRole("button", { name: /Hjärta: 1 reaktion/ });
  await expect(heartChip).toBeVisible();
  await expect(heartChip).toContainText("Robin");

  const ownReactionChip = samReview.getByRole("button", { name: /Ser gott ut: 1 reaktion/ });
  await expect(ownReactionChip).toBeVisible();
  await expect(ownReactionChip).toContainText("Alex");
  await ownReactionChip.click();
  await expect(page.getByText("Alex (Du)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ta bort din ser gott ut-reaktion" }).click();
  await expect(samReview.getByRole("button", { name: /Ser gott ut:/ })).toHaveCount(0);

  await expect(samReview.getByRole("button", { name: /Roligt:/ })).toHaveCount(0);
  await expect(samReview.getByRole("button", { name: /Visa detaljer/ })).toHaveCount(0);
  await expect(samReview.getByText("Smak", { exact: true })).toBeVisible();
  await expect(samReview.getByText("Prisvärt", { exact: true })).toBeVisible();
  await expect(samReview.getByText("Service", { exact: true })).toBeVisible();

  const reactButton = samReview.getByRole("button", { name: "Reagera på Sams omdöme" });
  await expect(reactButton).toHaveText("Reagera");
  await reactButton.click();

  let picker = samReview.getByRole("group", { name: "Välj reaktion" });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-reaction-picker", "inline");

  const pickerBox = await picker.boundingBox();
  const reviewBox = await samReview.boundingBox();
  expect(pickerBox).not.toBeNull();
  expect(reviewBox).not.toBeNull();
  expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(
    reviewBox!.y + reviewBox!.height + 1,
  );

  await picker.getByRole("button", { name: "Hjärta" }).click();

  let updatedSamReview = page
    .getByRole("dialog")
    .first()
    .locator('[data-review-id="review-v2-sam"]');
  const selectedHeartChip = updatedSamReview.getByRole("button", {
    name: /Hjärta: 2 reaktioner/,
  });
  await expect(selectedHeartChip).toBeVisible();
  await expect(selectedHeartChip).toContainText("Robin");
  await expect(selectedHeartChip).toContainText("+1");
  await selectedHeartChip.click();
  await expect(page.getByText("Alex (Du)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ta bort din hjärta-reaktion" }).click();

  updatedSamReview = page.getByRole("dialog").first().locator('[data-review-id="review-v2-sam"]');
  const remainingHeartChip = updatedSamReview.getByRole("button", { name: /Hjärta: 1 reaktion/ });
  await expect(remainingHeartChip).toContainText("Robin");

  await updatedSamReview.getByRole("button", { name: "Reagera på Sams omdöme" }).click();
  picker = updatedSamReview.getByRole("group", { name: "Välj reaktion" });
  await picker.getByRole("button", { name: "Roligt" }).click();
  updatedSamReview = page.getByRole("dialog").first().locator('[data-review-id="review-v2-sam"]');
  await expect(updatedSamReview.getByRole("button", { name: /Roligt: 1 reaktion/ })).toBeVisible();

  await updatedSamReview.getByRole("button", { name: "Reagera på Sams omdöme" }).click();
  await updatedSamReview
    .getByRole("group", { name: "Välj reaktion" })
    .getByRole("button", { name: /^Roligt, vald/ })
    .click();
  await expect(updatedSamReview.getByRole("button", { name: /Roligt:/ })).toHaveCount(0);

  await remainingHeartChip.click();
  await expect(
    page.locator("[data-radix-popper-content-wrapper]").getByText("Robin", { exact: true }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page, reactionBar, "reaktionsflöde på 360 px");
  await expectNoHorizontalOverflow(page, dialog, "omdömeskort på 360 px");
});

test("Hem fokuserar senaste omdömet tills användaren interagerar", async ({ page }) => {
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
  const focusedReactButton = focusedReview.getByRole("button", {
    name: "Reagera på Robins omdöme",
  });
  await expect(focusedReactButton).toBeVisible();
  await expect(focusedReactButton).not.toHaveAttribute("data-emphasized", "true");

  const ownReview = dialog.locator("[data-review-id]").filter({ hasText: "Alex" }).first();
  const ownActionRow = ownReview.locator("[data-review-action-row]");
  await expect(ownActionRow.getByRole("button", { name: "Reagera på Alexs omdöme" })).toBeVisible();
  await expect(ownActionRow.getByRole("button", { name: "Redigera omdöme" })).toBeVisible();
  await expectNoHorizontalOverflow(page, ownActionRow, "egen handlingsrad på 360 px");

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

  await page.waitForTimeout(2_500);
  await expect(focusedReview).toHaveAttribute("data-review-highlighted", "true");

  const scrollTopBeforeReaction = await dialog.evaluate((element) => element.scrollTop);
  await focusedReactButton.click();
  await expect(focusedReview).not.toHaveAttribute("data-review-highlighted", "true");
  await focusedReview
    .getByRole("group", { name: "Välj reaktion" })
    .getByRole("button", { name: "Hjärta" })
    .click();
  await expect(focusedReview.getByRole("button", { name: /Hjärta: 1 reaktion/ })).toBeVisible();
  await expect
    .poll(async () => {
      const scrollTopAfterReaction = await dialog.evaluate((element) => element.scrollTop);
      return Math.abs(scrollTopAfterReaction - scrollTopBeforeReaction);
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
  const reactButton = focusedReview.getByRole("button", { name: "Reagera på Sams omdöme" });
  await expect(reactButton).toBeVisible();
  await expect(reactButton).not.toHaveAttribute("data-emphasized", "true");
  await expect(focusedReview.getByText("Smak", { exact: true })).toBeVisible();
  await expect(focusedReview.getByRole("button", { name: /Visa detaljer/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, dialog, "deep-linkat omdöme på 360 px");

  await expect(focusedReview).not.toHaveAttribute("data-review-highlighted", "true", {
    timeout: 8_500,
  });
});

test("reaktionsraden behåller samma kompakta hierarki på desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p3?visit=v2");

  const dialog = page.getByRole("dialog").first();
  const samReview = dialog.locator('[data-review-id="review-v2-sam"]');
  const heartChip = samReview.getByRole("button", { name: /Hjärta: 1 reaktion/ });
  await expect(heartChip).toBeVisible();
  await expect(heartChip).toContainText("Robin");
  await expect(samReview.getByRole("button", { name: "Reagera på Sams omdöme" })).toBeVisible();
  await expect(samReview.getByRole("button", { name: /Fler reaktioner/ })).toHaveCount(0);
  await expect(samReview.getByRole("button", { name: /Visa detaljer/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, dialog, "reaktionsflöde på desktop");
});
