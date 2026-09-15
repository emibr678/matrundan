import { expect, test, type Page } from "@playwright/test";

function isExternalPlaceProviderRequest(requestUrl: string): boolean {
  try {
    const hostname = new URL(requestUrl).hostname;
    return (
      hostname === "geoapify.com" ||
      hostname.endsWith(".geoapify.com") ||
      hostname === "openstreetmap.org" ||
      hostname.endsWith(".openstreetmap.org")
    );
  } catch {
    return false;
  }
}

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
  await page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" }).click();
  await page.getByRole("menuitem", { name: "Om Matrundan" }).click();
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

  const leaderboard = page.getByTestId("occasion-leaderboard");
  const collectionHeading = page.getByRole("heading", { name: "Gruppens ställen" });
  const search = page.getByRole("textbox", { name: "Sök bland gruppens ställen" });
  const filterButton = page.getByRole("button", { name: "Öppna filter och sortering" });

  await expect(leaderboard).toBeVisible();
  await expect(leaderboard.getByRole("link", { name: /Ledare i topplistan:/ })).toBeVisible();
  await expect(collectionHeading).toBeVisible();
  await expect(
    collectionHeading
      .locator("..")
      .getByText(/\d+ ställen? som gruppen vill prova eller har besökt/),
  ).toBeVisible();
  await expect(search).toHaveAttribute("placeholder", "Sök bland gruppens ställen");

  const [topListTop, collectionTop, searchBox, filterBox] = await Promise.all([
    leaderboard.evaluate((element) => element.getBoundingClientRect().top),
    collectionHeading.evaluate((element) => element.getBoundingClientRect().top),
    search.boundingBox(),
    filterButton.boundingBox(),
  ]);
  expect(topListTop).toBeLessThan(collectionTop);
  expect(collectionTop).toBeLessThan(searchBox!.y);
  expect(Math.abs(searchBox!.y - filterBox!.y)).toBeLessThanOrEqual(1);

  const longStatusBox = await page
    .getByText("3 av 5 har provat", { exact: true })
    .first()
    .boundingBox();
  expect(longStatusBox).not.toBeNull();
  expect(longStatusBox!.x + longStatusBox!.width).toBeLessThanOrEqual(360);

  await search.fill("Kvarterets");
  await expect(leaderboard).toBeVisible();
  await expect(page.getByRole("link", { name: /Kvarterets Kardemumma Café/ })).toBeVisible();

  await search.fill("Päronträdets Trattoria");
  const addFromSearch = page.getByRole("button", {
    name: "Sök efter Päronträdets Trattoria och lägg till ställe",
  });
  await expect(addFromSearch).toBeVisible();
  await addFromSearch.click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await expect(addDialog.getByLabel("Sök matställen")).toHaveValue("Päronträdets Trattoria");
  await page.keyboard.press("Escape");
  await expect(addDialog).toBeHidden();

  await search.fill("");
  await leaderboard.getByRole("button", { name: "Visa topp 3", exact: true }).click();
  await expect(
    leaderboard.getByRole("button", { name: "Visa topplista för alla betyg" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalOverflow(page, "Matställen");

  await page.goto("/matstallen/p7?demo=1");
  const registerVisit = page.getByRole("button", { name: "Registrera besök igen" }).first();
  const proposeNextStop = page.getByRole("button", { name: "Föreslå som nästa stopp" });
  await expect(registerVisit).toBeVisible();
  await expect(proposeNextStop).toBeVisible();
  await expect(proposeNextStop).toHaveAttribute("aria-pressed", "false");

  const favorite = page.getByRole("button", { name: "Markera som favorit" });
  const favoriteBox = await favorite.boundingBox();
  expect(favoriteBox?.width).toBeGreaterThanOrEqual(44);
  expect(favoriteBox?.height).toBeGreaterThanOrEqual(44);

  const identityGrid = page.getByTestId("place-identity-grid");
  const practicalInfo = page.getByTestId("place-practical-info");
  const addressRow = page.getByTestId("place-address-row");
  const compactRow = page.getByTestId("place-practical-links");
  const mapsLink = page.getByRole("link", { name: /Öppna .* i Google Maps/ });
  const websiteAction = page.getByRole("button", { name: "Lägg till webbplats" });
  const openingHours = page.getByLabel(/^Öppettider:/);
  const checkInfo = page.getByRole("button", { name: "Kontrollera uppgifter" });

  await expect(identityGrid).toBeVisible();
  await expect(practicalInfo).toBeVisible();
  await expect(addressRow).toBeVisible();
  await expect(compactRow).toBeVisible();
  await expect(mapsLink).toBeVisible();
  await expect(websiteAction).toBeVisible();
  await expect(openingHours).toBeVisible();
  await expect(checkInfo).toBeVisible();
  await expect(page.getByTestId("place-info-status-dot")).toHaveCount(0);
  await expect(page.getByTestId("next-stop-accent")).toHaveCount(0);

  const compactLayout = await compactRow.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { display: style.display, columns: style.gridTemplateColumns };
  });
  expect(compactLayout.display).toBe("grid");
  expect(compactLayout.columns.split(" ")).toHaveLength(2);

  const [addressBox, compactBox, websiteBox, openingBox, checkBox, registerBoxBefore] =
    await Promise.all([
      addressRow.boundingBox(),
      compactRow.boundingBox(),
      websiteAction.boundingBox(),
      openingHours.boundingBox(),
      checkInfo.boundingBox(),
      registerVisit.boundingBox(),
    ]);
  expect(addressBox).not.toBeNull();
  expect(compactBox).not.toBeNull();
  expect(websiteBox).not.toBeNull();
  expect(openingBox).not.toBeNull();
  expect(checkBox).not.toBeNull();
  expect(registerBoxBefore).not.toBeNull();
  expect(addressBox!.height).toBeGreaterThanOrEqual(44);
  expect(websiteBox!.height).toBeGreaterThanOrEqual(44);
  expect(openingBox!.height).toBeGreaterThanOrEqual(44);
  expect(checkBox!.width).toBeGreaterThanOrEqual(44);
  expect(checkBox!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(websiteBox!.y - openingBox!.y)).toBeLessThanOrEqual(1);
  expect(compactBox!.y).toBeGreaterThanOrEqual(addressBox!.y + addressBox!.height - 1);

  const registerVisitTopBefore = registerBoxBefore!.y;
  const practicalInfoTopBefore = practicalInfo.boundingBox().then((box) => box?.y ?? 0);
  await proposeNextStop.click();
  const proposalStatus = page.getByRole("button", { name: "På förslag" });
  await expect(proposalStatus).toBeVisible();
  await expect(proposalStatus).toBeDisabled();
  await expect(proposalStatus).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("next-stop-accent")).toHaveCount(0);

  const [practicalInfoBoxWithNextStop, registerVisitBoxWithNextStop] = await Promise.all([
    practicalInfo.boundingBox(),
    registerVisit.boundingBox(),
  ]);
  expect(practicalInfoBoxWithNextStop).not.toBeNull();
  expect(registerVisitBoxWithNextStop).not.toBeNull();
  expect(
    Math.abs(practicalInfoBoxWithNextStop!.y - (await practicalInfoTopBefore)),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(registerVisitBoxWithNextStop!.y - registerVisitTopBefore)).toBeLessThanOrEqual(1);

  await checkInfo.click();
  const checkSheet = page.getByTestId("place-info-check-sheet");
  await expect(checkSheet).toBeVisible();
  await expect(checkSheet.getByRole("heading", { name: "Kontrollera uppgifter" })).toBeVisible();
  await expect(checkSheet.getByText("Adress och kartposition", { exact: true })).toBeVisible();
  await expect(checkSheet.getByText("Webbplats", { exact: true })).toBeVisible();
  await expect(checkSheet.getByText("Öppettider", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Kontrollera uppgifter i exempelgruppen");
});

test("exempelgruppen visar nya kartuppgifter utan externa anrop", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (isExternalPlaceProviderRequest(request.url())) externalRequests.push(request.url());
  });

  await page.goto("/matstallen/p5?demo=1");
  const trigger = page.getByRole("button", {
    name: "Kontrollera uppgifter – nya uppgifter finns",
  });
  await expect(trigger).toBeVisible();
  await expect(page.getByTestId("place-info-status-dot")).toBeVisible();
  await trigger.click();

  const sheet = page.getByTestId("place-info-check-sheet");
  await expect(sheet.getByText("Ny uppgift finns", { exact: true }).first()).toBeVisible();
  const applyAddress = sheet.getByRole("button", { name: "Använd ny adress" });
  await expect(applyAddress).toBeVisible();
  await applyAddress.click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("place-address-row")).toContainText("Utsiktsgränd 25");
  await expect(page.getByTestId("place-info-status-dot")).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
