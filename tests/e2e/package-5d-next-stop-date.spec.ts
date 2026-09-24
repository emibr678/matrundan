import { expect, test, type Page } from "@playwright/test";

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function pastDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function resetDemo(page: Page) {
  await page.goto("/?demo=1");
  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    window.localStorage.removeItem("matrundan.nextStop.v2.g1");
    window.localStorage.removeItem("matrundan.nextStop.v2.responses.g1");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.example-stockholm");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.responses.example-stockholm");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.reveal");
    window.localStorage.removeItem("matrundan.nextStopDate.v1.g1");
  });
  await page.reload();
}

async function proposeAlternativeFromDetail(page: Page) {
  await page.goto("/matstallen/p1?demo=1");
  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  await expect(page.getByRole("button", { name: "På förslag" })).toBeVisible();
  await page.goto("/?demo=1");
}

async function expectNoOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

function dayRow(page: Page) {
  return page.getByRole("button", { name: /Öppna dagsvaren för/ });
}

async function ensureDay(page: Page, days = 7) {
  if ((await dayRow(page).count()) > 0) return;
  await page.getByRole("button", { name: "Föreslå dag" }).click();
  const dialog = page.getByRole("dialog", { name: "Föreslå dag" });
  await dialog.getByLabel("Dag").fill(futureDate(days));
  await dialog.getByRole("button", { name: "Spara" }).click();
  await expect(dayRow(page)).toBeVisible();
}

test("karusellen visar nästa stopp först och nyaste egna förslaget direkt efter tillägg", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  await expect(focused).toBeVisible();
  await expect(focused.getByText("Valt nästa stopp", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveCount(0);
  const selectedName = await focused.getByRole("heading").textContent();

  await proposeAlternativeFromDetail(page);
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  await expect(alternative).toBeVisible();
  await expect(alternative.getByText("Förslag", { exact: true })).toBeVisible();
  await expect(alternative.getByText("Lilla Myntans Matrum", { exact: true })).toBeVisible();
  await expect(alternative.getByText(/föreslog/i)).toBeVisible();
  await expect(alternative.getByRole("button", { name: /Jag vill hit/ })).toBeVisible();
  await expect(alternative.getByRole("button", { name: "Gör till nästa stopp" })).toBeVisible();
  await expect(page.getByText("2 förslag", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 2");
  await expect(page.getByRole("button", { name: /Föregående förslag:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nästa förslag:/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Föregående förslag:/ }).click();
  await expect(page.locator('[data-next-stop-proposal="selected"]')).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 2");
  await expect(page.getByRole("button", { name: /Nästa förslag:/ })).toBeVisible();
  expect(
    await page.locator('[data-next-stop-proposal="selected"]').getByRole("heading").textContent(),
  ).toBe(selectedName);
  await expectNoOverflow(page);
});
test("karusellen glider med horisontell scroll-snap och följer sidpositionen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const viewport = page.getByTestId("next-stop-carousel-viewport");
  await expect(viewport).toHaveCSS("scroll-snap-type", /x/);

  await page.getByRole("button", { name: /Föregående förslag:/ }).click();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 2");
  const firstScrollLeft = await viewport.evaluate((element) => element.scrollLeft);
  expect(firstScrollLeft).toBeLessThan(20);

  await page.getByRole("button", { name: /Nästa förslag:/ }).click();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 2");
  const secondScrollLeft = await viewport.evaluate((element) => element.scrollLeft);
  expect(secondScrollLeft).toBeGreaterThan(300);
  await expectNoOverflow(page);
});

test("Jag vill hit kan markeras på både nästa stopp och ett karusellförslag utan omsortering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  const beforeName = await focused.getByRole("heading").textContent();
  const focusedSupport = focused.getByRole("button", { name: /Jag vill hit/ });
  if ((await focusedSupport.getAttribute("aria-pressed")) !== "true") await focusedSupport.click();
  await expect(focusedSupport).toHaveAttribute("aria-pressed", "true");

  await proposeAlternativeFromDetail(page);
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  const alternativeSupport = alternative.getByRole("button", { name: /Jag vill hit/ });
  if ((await alternativeSupport.getAttribute("aria-pressed")) !== "true") {
    await alternativeSupport.click();
  }
  await expect(alternativeSupport).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 2");

  await page.getByRole("button", { name: /Visa nästa stopp:/ }).click();
  const afterName = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  expect(afterName).toBe(beforeName);
  await expectNoOverflow(page);
});
test("dagen använder bara Jag kan och Jag kan inte i en bottom sheet", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await ensureDay(page);

  await dayRow(page).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Kan du den dagen?", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Jag kan", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Jag kan inte" })).toBeVisible();
  await expect(sheet.getByText(/Osäker/i)).toHaveCount(0);
  await expect(sheet.getByText(/18:30|19:15/)).toHaveCount(0);

  const canButton = sheet.getByRole("button", { name: "Jag kan", exact: true });
  if ((await canButton.getAttribute("aria-pressed")) !== "true") await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByText(/Kan:/)).toBeVisible();
  await expectNoOverflow(page);
});

test("föreslå annan dag nollställer gruppens dagsvar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await ensureDay(page);

  await dayRow(page).click();
  let sheet = page.getByRole("dialog");
  const canButton = sheet.getByRole("button", { name: "Jag kan", exact: true });
  if ((await canButton.getAttribute("aria-pressed")) !== "true") await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");

  await sheet.getByRole("button", { name: "Föreslå annan dag" }).click();
  const dateDialog = page.getByRole("dialog", { name: "Föreslå annan dag" });
  await dateDialog.getByLabel("Dag").fill(futureDate(14));
  await dateDialog.getByRole("button", { name: "Spara" }).click();

  await dayRow(page).click();
  sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Jag kan", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(sheet.getByText("Ingen har svarat än.", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("Välj som nästa stopp flyttar karusellförslaget till första positionen och bevarar planeringen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await ensureDay(page);

  const beforeName = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  await dayRow(page).click();
  let sheet = page.getByRole("dialog");
  const canButton = sheet.getByRole("button", { name: "Jag kan", exact: true });
  if ((await canButton.getAttribute("aria-pressed")) !== "true") await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  const beforeDay = await dayRow(page).getAttribute("aria-label");

  await proposeAlternativeFromDetail(page);
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  const support = alternative.getByRole("button", { name: /Jag vill hit/ });
  if ((await support.getAttribute("aria-pressed")) !== "true") await support.click();
  await expect(support).toHaveAttribute("aria-pressed", "true");

  await alternative.getByRole("button", { name: "Gör till nästa stopp" }).click();
  const switchDialog = page.getByRole("dialog", { name: "Gör det här till nästa stopp?" });
  await expect(switchDialog).toContainText(
    "Dagen, dagsvaren och allas Jag vill hit-markeringar ligger kvar",
  );
  await switchDialog.getByRole("button", { name: "Gör till nästa stopp" }).click();

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  const afterName = await selected.getByRole("heading").textContent();
  expect(afterName).not.toBe(beforeName);
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 2");
  await expect(dayRow(page)).toHaveAttribute("aria-label", beforeDay ?? "");
  await expect(selected.getByRole("button", { name: /Jag vill hit/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await dayRow(page).click();
  sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Jag kan", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoOverflow(page);
});
test("Slumpa förslag visar det nya alternativet utan att skriva över nästa stopp", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const before = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  await page.getByRole("button", { name: "Slumpa förslag" }).click();

  await expect(page.locator('[data-next-stop-proposal="alternative"]')).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 2");
  await page.getByRole("button", { name: /Visa nästa stopp:/ }).click();
  const after = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  expect(after).toBe(before);
  await expectNoOverflow(page);
});

test("matställedetaljen öppnar det nyss tillagda förslaget när Hem visas", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  const before = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();

  await proposeAlternativeFromDetail(page);

  await expect(page.locator('[data-next-stop-proposal="alternative"]')).toContainText(
    "Lilla Myntans Matrum",
  );
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 2");
  await page.getByRole("button", { name: /Visa nästa stopp:/ }).click();
  const after = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  expect(after).toBe(before);
});

test("övriga karusellförslag sorteras nyast först", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  for (const placeId of ["p1", "p2", "p3"]) {
    await page.goto(`/matstallen/${placeId}?demo=1`);
    await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
    await expect(page.getByRole("button", { name: "På förslag" })).toBeVisible();
  }
  await page.goto("/?demo=1");

  await expect(page.locator('[data-next-stop-proposal="alternative"]')).toContainText(
    "Månskärans Taquería",
  );
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 4");
  const labels = await page
    .getByLabel("Välj förslag i karusellen")
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(labels.slice(1)).toEqual([
    "Visa förslag: Månskärans Taquería",
    "Visa förslag: Kvarterets Kardemumma",
    "Visa förslag: Lilla Myntans Matrum",
  ]);
  await expectNoOverflow(page);
});
test("passerad dag frågar vad som hände utan att återinföra tid", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await page.evaluate((date) => {
    window.localStorage.setItem(
      "matrundan.nextStop.v2.g1",
      JSON.stringify({
        revision: 3,
        plannedDate: date,
        plannedTime: "18:30",
        selectedPlaceId: "p5",
        proposals: [
          {
            id: "demo-past-p5",
            placeId: "p5",
            proposedBy: "m2",
            createdAt: new Date().toISOString(),
            supports: [],
          },
        ],
      }),
    );
  }, pastDate(1));
  await page.reload();

  await expect(page.getByRole("heading", { name: "Blev det av?" })).toBeVisible();
  await expect(page.getByText(/18:30/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Registrera besöket" })).toBeVisible();
  await page.getByRole("button", { name: "Det blev inte av" }).click();

  await expect(page.getByRole("heading", { name: "Blev det av?" })).toHaveCount(0);
  await expect(page.locator('[data-next-stop-proposal="selected"]')).toBeVisible();
  await expectNoOverflow(page);
});
