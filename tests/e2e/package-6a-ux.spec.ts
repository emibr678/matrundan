import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          text: element.textContent?.trim().slice(0, 40) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
      .slice(0, 5);

    return {
      documentClientWidth: viewportWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders,
    };
  });

  expect(
    metrics.documentScrollWidth,
    `${context}: dokumentet får inte ha horisontell overflow. ${JSON.stringify(metrics.offenders)}`,
  ).toBeLessThanOrEqual(metrics.documentClientWidth);
  expect(
    metrics.bodyScrollWidth,
    `${context}: body får inte ha horisontell overflow. ${JSON.stringify(metrics.offenders)}`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth);
}

test("huvudvyerna har tydliga roller och handlingar på mobil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await page.goto("/?demo=1");
  await expect(page.getByText("Fredagsgänget", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Nästa stopp", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Senaste aktivitet" })).toHaveCount(0);
  await expect(page.getByText(/^Ni har provat \d+ av \d+ ställen tillsammans$/)).toBeVisible();
  await expect(page.getByText(/^\d+%$/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Alla besök" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Hem");
  const latestVisit = page.getByRole("link", { name: /^Öppna besöket på / });
  await expect(latestVisit).toBeVisible();
  await latestVisit.click();
  await expect(page).toHaveURL(/\/besok\?visit=/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Besöksdetalj från Hem");

  await page.goto("/gruppen?demo=1");
  await expect(page.getByRole("heading", { name: "Aktivitet" })).toBeVisible();
  await expect(page.getByText("Nästa stopp", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Gruppen");
  const visitActivity = page.locator('a[href^="/besok?visit="]').first();
  await expect(visitActivity).toBeVisible();
  await visitActivity.click();
  await expect(page).toHaveURL(/\/besok\?visit=/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Besöksdetalj från Aktivitet");

  await page.goto("/matstallen?demo=1");
  await expect(
    page.getByText("Vad gänget vill prova och har provat", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till ställe", exact: true })).toBeVisible();

  const search = page.getByRole("textbox", { name: "Sök bland gruppens ställen" });
  await expect(search).toHaveAttribute("placeholder", "Sök bland gruppens ställen");
  const searchTop = await search.evaluate((element) => element.getBoundingClientRect().top);
  const topListTop = await page.getByRole("heading", { name: "Topplista" }).evaluate((element) => {
    return element.getBoundingClientRect().top;
  });
  expect(searchTop).toBeLessThan(topListTop);
  await search.fill("Kvarterets");
  await expect(page.getByTestId("occasion-leaderboard")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Kvarterets Kardemumma/ })).toBeVisible();
  await search.fill("");
  const leaderboard = page.getByTestId("occasion-leaderboard");
  await expect(leaderboard).toBeVisible();
  await leaderboard.getByRole("button", { name: "Visa", exact: true }).click();
  await expect(leaderboard.getByRole("button", { name: "Visa topplista för alla betyg" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoHorizontalOverflow(page, "Matställen");

  await page.goto("/matstallen/p8?demo=1");
  await expect(page.getByRole("button", { name: "Registrera besök" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Föreslå som nästa stopp" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Markera som favorit" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Öppna .* i Google Maps/ })).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Om stället" })
      .locator("..")
      .getByRole("button", { name: "Ändra gruppens uppgifter om stället" }),
  ).toBeVisible();
  const visitHistoryTop = await page
    .getByRole("heading", { name: /^Besök/ })
    .evaluate((element) => element.getBoundingClientRect().top);
  const aboutPlaceTop = await page
    .getByRole("heading", { name: "Om stället" })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(visitHistoryTop).toBeLessThan(aboutPlaceTop);

  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  await expect(page.getByText("Nästa stopp", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ta bort som nästa stopp" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Matställets detaljsida");
});
