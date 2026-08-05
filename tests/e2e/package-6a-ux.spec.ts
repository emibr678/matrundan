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
  await expect(page.getByRole("button", { name: "Föreslå som nästa stopp" })).toBeVisible();

  const favorite = page.getByRole("button", { name: "Markera som favorit" });
  await expect(favorite).toBeVisible();
  const favoriteBox = await favorite.boundingBox();
  expect(favoriteBox?.width).toBeGreaterThanOrEqual(44);
  expect(favoriteBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("Favorit", { exact: true })).toHaveCount(0);

  const practicalLinks = page.getByTestId("place-practical-links");
  const identityGrid = practicalLinks.locator("..");
  await expect(practicalLinks).toBeVisible();
  const [practicalLinkLayout, identityLayout] = await Promise.all([
    practicalLinks.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        display: style.display,
        flexDirection: style.flexDirection,
        rowGap: Number.parseFloat(style.rowGap) || 0,
      };
    }),
    identityGrid.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        display: style.display,
        columns: style.gridTemplateColumns,
      };
    }),
  ]);
  expect(identityLayout.display).toBe("grid");
  expect(identityLayout.columns.split(" ")).toHaveLength(2);
  expect(practicalLinkLayout.display).toBe("flex");
  expect(practicalLinkLayout.flexDirection).toBe("column");
  expect(practicalLinkLayout.rowGap).toBeLessThanOrEqual(1);

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
  ] = await Promise.all([
    mapsLink.boundingBox(),
    secondaryPracticalAction.boundingBox(),
    secondaryPracticalIcon.boundingBox(),
    mapsIcon.boundingBox(),
    placeHeading.boundingBox(),
    placeThumb.boundingBox(),
    placeThumbVisual.boundingBox(),
  ]);
  expect(mapsLinkBox).not.toBeNull();
  expect(secondaryActionBox).not.toBeNull();
  expect(secondaryIconBox).not.toBeNull();
  expect(mapsIconBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(thumbBox).not.toBeNull();
  expect(thumbVisualBox).not.toBeNull();
  expect(Math.abs(mapsLinkBox!.x - headingBox!.x)).toBeLessThanOrEqual(2);
  expect(mapsLinkBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height - 1);
  expect(secondaryActionBox!.y).toBeGreaterThanOrEqual(mapsLinkBox!.y + mapsLinkBox!.height - 1);
  expect(Math.abs(secondaryIconBox!.x - mapsIconBox!.x)).toBeLessThanOrEqual(2);
  expect(thumbBox!.width).toBeGreaterThanOrEqual(60);
  expect(thumbBox!.width).toBeLessThanOrEqual(84);
  expect(thumbVisualBox!.width).toBeGreaterThanOrEqual(60);
  expect(thumbVisualBox!.width).toBeLessThanOrEqual(84);
  expect(Math.abs(thumbVisualBox!.width - thumbVisualBox!.height)).toBeLessThanOrEqual(1);
  expect(mapsLinkBox!.height).toBeGreaterThanOrEqual(44);
  expect(secondaryActionBox!.height).toBeGreaterThanOrEqual(44);
  // Adressen ligger direkt under namnet, utan reserverat tomrum när statusen saknas.
  expect(mapsLinkBox!.y - (headingBox!.y + headingBox!.height)).toBeLessThanOrEqual(16);
  await expect(page.getByText("Google Maps", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Nytt för gruppen", { exact: true })).toHaveCount(0);
  // Kartdataunderhållet ska inte längre ta en egen synlig rad i kortet.
  await expect(page.getByText("Kontrollera kartdata", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("place-location-refresh")).toHaveCount(0);


  const openingHours = page.getByText("Öppettider", { exact: true });
  const openingHoursIcon = openingHours.locator("..").locator("svg").first();
  await expect(openingHours).toBeVisible();
  await expect(openingHoursIcon).toBeVisible();
  const [openingHoursIconBox, registerVisitBox] = await Promise.all([
    openingHoursIcon.boundingBox(),
    registerVisit.boundingBox(),
  ]);
  expect(openingHoursIconBox).not.toBeNull();
  expect(registerVisitBox).not.toBeNull();
  expect(Math.abs(openingHoursIconBox!.x - registerVisitBox!.x)).toBeLessThanOrEqual(2);
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

  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  const nextStopBadge = page.getByText("Nästa stopp", { exact: true });
  await expect(nextStopBadge).toBeVisible();
  await expect(page.getByRole("button", { name: "Ta bort som nästa stopp" })).toBeVisible();
  // Med statusbadge ligger adressen fortfarande i samma textkolumn, direkt under badgen.
  const [nextStopBox, mapsLinkBoxWithBadge, headingBoxWithBadge] = await Promise.all([
    nextStopBadge.boundingBox(),
    mapsLink.boundingBox(),
    placeHeading.boundingBox(),
  ]);
  expect(nextStopBox!.y).toBeGreaterThanOrEqual(
    headingBoxWithBadge!.y + headingBoxWithBadge!.height - 1,
  );
  expect(mapsLinkBoxWithBadge!.y).toBeGreaterThanOrEqual(nextStopBox!.y + nextStopBox!.height - 1);
  expect(Math.abs(mapsLinkBoxWithBadge!.x - headingBoxWithBadge!.x)).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page, "Matställets detaljsida");

});
