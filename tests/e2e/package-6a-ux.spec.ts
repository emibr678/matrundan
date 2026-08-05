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
  await expect(page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" })).toBeVisible();
  await expect(page.locator("header").getByText("Fredagsgänget", { exact: true })).toHaveCount(1);
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

  await page.goto("/gruppen?demo=1");
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  await page.getByRole("button", { name: /Om Matrundan/ }).click();
  await expect(page.getByRole("heading", { name: "Om Matrundan" })).toBeVisible();
  await expect(
    page.getByText(/Matrundan hjälper vänner och familjer att samla matställen/),
  ).toBeVisible();
  await expect(page.getByText("Vad är nytt", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Öppna versionshistoriken" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Om Matrundan");

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
  await expect(
    leaderboard.getByRole("button", { name: "Visa topplista för alla betyg" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalOverflow(page, "Matställen");

  await page.goto("/matstallen/p7?demo=1");
  const registerVisit = page.getByRole("button", { name: "Registrera besök igen" }).first();
  await expect(registerVisit).toBeVisible();
  const proposeNextStop = page.getByRole("button", { name: "Föreslå som nästa stopp" });
  await expect(proposeNextStop).toBeVisible();
  await expect(proposeNextStop).toHaveAttribute("aria-pressed", "false");

  const favorite = page.getByRole("button", { name: "Markera som favorit" });
  await expect(favorite).toBeVisible();
  const favoriteBox = await favorite.boundingBox();
  expect(favoriteBox?.width).toBeGreaterThanOrEqual(44);
  expect(favoriteBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("Favorit", { exact: true })).toHaveCount(0);

  const identityGrid = page.getByTestId("place-identity-grid");
  const practicalInfo = page.getByTestId("place-practical-info");
  const practicalLinks = page.getByTestId("place-practical-links");
  await expect(identityGrid).toBeVisible();
  await expect(practicalInfo).toBeVisible();
  await expect(practicalLinks).toBeVisible();
  const [identityLayout, practicalLayout] = await Promise.all([
    identityGrid.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        display: style.display,
        columns: style.gridTemplateColumns,
      };
    }),
    practicalLinks.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        display: style.display,
        flexDirection: style.flexDirection,
      };
    }),
  ]);
  expect(identityLayout.display).toBe("grid");
  expect(identityLayout.columns.split(" ")).toHaveLength(2);
  expect(practicalLayout.display).toBe("flex");
  expect(practicalLayout.flexDirection).toBe("column");

  const mapsLink = page.getByRole("link", { name: /Öppna .* i Google Maps/ });
  const secondaryPracticalAction = practicalLinks.locator("a, button").nth(1);
  const secondaryPracticalIcon = secondaryPracticalAction.locator("svg").first();
  const mapsIcon = mapsLink.locator("svg").first();
  const placeHeading = page.locator("h1");
  const placeThumb = page.locator('[data-slot="place-thumb"]').first();
  const placeThumbVisual = placeThumb.locator('[data-slot="place-thumb-visual"]');
  await expect(mapsLink).toBeVisible();
  await expect(secondaryPracticalAction).toBeVisible();
  await expect(mapsLink).toHaveClass(/text-primary/);
  const [
    mapsLinkBox,
    secondaryActionBox,
    secondaryIconBox,
    mapsIconBox,
    headingBox,
    thumbBox,
    thumbVisualBox,
    identityGridBox,
    practicalInfoBox,
  ] = await Promise.all([
    mapsLink.boundingBox(),
    secondaryPracticalAction.boundingBox(),
    secondaryPracticalIcon.boundingBox(),
    mapsIcon.boundingBox(),
    placeHeading.boundingBox(),
    placeThumb.boundingBox(),
    placeThumbVisual.boundingBox(),
    identityGrid.boundingBox(),
    practicalInfo.boundingBox(),
  ]);
  expect(mapsLinkBox).not.toBeNull();
  expect(secondaryActionBox).not.toBeNull();
  expect(secondaryIconBox).not.toBeNull();
  expect(mapsIconBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(thumbBox).not.toBeNull();
  expect(thumbVisualBox).not.toBeNull();
  expect(identityGridBox).not.toBeNull();
  expect(practicalInfoBox).not.toBeNull();
  expect(practicalInfoBox!.x).toBeLessThanOrEqual(thumbBox!.x + 1);
  expect(practicalInfoBox!.width).toBeGreaterThanOrEqual(identityGridBox!.width - 1);
  expect(mapsLinkBox!.x).toBeLessThan(headingBox!.x);
  expect(secondaryActionBox!.y).toBeGreaterThanOrEqual(mapsLinkBox!.y + mapsLinkBox!.height - 1);
  expect(Math.abs(secondaryIconBox!.x - mapsIconBox!.x)).toBeLessThanOrEqual(2);
  expect(thumbBox!.width).toBeGreaterThanOrEqual(60);
  expect(thumbBox!.width).toBeLessThanOrEqual(84);
  expect(thumbVisualBox!.width).toBeGreaterThanOrEqual(60);
  expect(thumbVisualBox!.width).toBeLessThanOrEqual(84);
  expect(Math.abs(thumbVisualBox!.width - thumbVisualBox!.height)).toBeLessThanOrEqual(1);
  expect(mapsLinkBox!.height).toBeGreaterThanOrEqual(44);
  expect(secondaryActionBox!.height).toBeGreaterThanOrEqual(44);
  await expect(identityGrid.getByText("Nästa stopp", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Google Maps", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Nytt för gruppen", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Kontrollera kartdata", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("place-location-refresh-trigger")).toHaveCount(0);
  await expect(page.getByTestId("place-location-refresh")).toHaveCount(0);

  const openingHours = page.getByText("Öppettider", { exact: true });
  const openingHoursIcon = openingHours.locator("..").locator("svg").first();
  await expect(openingHours).toBeVisible();
  await expect(openingHoursIcon).toBeVisible();
  const [openingHoursIconBox, registerVisitBoxBefore] = await Promise.all([
    openingHoursIcon.boundingBox(),
    registerVisit.boundingBox(),
  ]);
  expect(openingHoursIconBox).not.toBeNull();
  expect(registerVisitBoxBefore).not.toBeNull();
  expect(Math.abs(openingHoursIconBox!.x - mapsIconBox!.x)).toBeLessThanOrEqual(2);
  await expect(page.getByText("Ingen i gruppen har varit här än", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1 besök", { exact: true })).toBeVisible();
  const openingHoursTop = await openingHours.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const primaryActionTop = await registerVisit.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  expect(openingHoursTop).toBeLessThan(primaryActionTop);

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
  const reportTop = await page
    .getByRole("button", { name: "Rapportera felaktig information" })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(reportTop).toBeGreaterThan(aboutPlaceTop);

  const practicalInfoTopBefore = practicalInfoBox!.y;
  const registerVisitTopBefore = registerVisitBoxBefore!.y;
  await proposeNextStop.click();
  const selectedNextStop = page.getByRole("button", { name: /Ta bort .* som nästa stopp/ });
  await expect(selectedNextStop).toBeVisible();
  await expect(selectedNextStop).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("next-stop-accent")).toBeVisible();
  await expect(identityGrid.getByText("Nästa stopp", { exact: true })).toHaveCount(0);

  const [practicalInfoBoxWithNextStop, registerVisitBoxWithNextStop] = await Promise.all([
    practicalInfo.boundingBox(),
    registerVisit.boundingBox(),
  ]);
  expect(practicalInfoBoxWithNextStop).not.toBeNull();
  expect(registerVisitBoxWithNextStop).not.toBeNull();
  expect(Math.abs(practicalInfoBoxWithNextStop!.y - practicalInfoTopBefore)).toBeLessThanOrEqual(1);
  expect(Math.abs(registerVisitBoxWithNextStop!.y - registerVisitTopBefore)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page, "Matställets detaljsida");
});
