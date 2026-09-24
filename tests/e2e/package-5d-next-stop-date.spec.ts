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
  await page.goto("/exempel");
  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    window.sessionStorage.removeItem("matrundan.exampleState.v4");
    window.sessionStorage.setItem("matrundan.exampleSession.v1", "1");
    window.localStorage.removeItem("matrundan.nextStop.v2.g1");
    window.localStorage.removeItem("matrundan.nextStop.v2.responses.g1");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.example-stockholm");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.responses.example-stockholm");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.reveal");
    window.localStorage.removeItem("matrundan.nextStopDate.v1.g1");
  });
  await page.reload();
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
  if (
    await dayRow(page)
      .isVisible()
      .catch(() => false)
  )
    return;
  await page.getByRole("button", { name: /Föreslå dag/ }).click();
  const dialog = page.getByRole("dialog", { name: "Föreslå dag" });
  await dialog.getByLabel("Dag").fill(futureDate(days));
  await dialog.getByRole("button", { name: "Spara" }).click();
  await expect(dayRow(page)).toBeVisible();
}

async function registerScorelessVisit(page: Page, buttonName: RegExp | string) {
  await page.getByRole("button", { name: buttonName }).first().click();
  const dialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Ett glas" }).click();
  await dialog.getByRole("button", { name: "Spara besök" }).click();
  await expect(dialog).toBeHidden();
}

test("exempelgruppen visar ett nästa stopp och två ställen på tur", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByText("Nästa stopp", { exact: true })).toBeVisible();
  await expect(selected.getByRole("heading", { name: "Gröna Terrassen" })).toBeVisible();
  await expect(page.getByText("2 på tur", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 3");
  await expect(page.getByText(/Jag vill hit|Flest vill hit/)).toHaveCount(0);

  const labels = await page
    .getByLabel("Välj ställe i kön")
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(labels).toEqual([
    "Visa nästa stopp: Gröna Terrassen",
    "Visa ställe på tur: Rundans Bistro",
    "Visa ställe på tur: Tacoateljén",
  ]);
  await expectNoOverflow(page);
});

test("ett nytt förslag läggs sist på tur men visas direkt som återkoppling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await page.goto("/matstallen/p2");
  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  await expect(page.getByRole("button", { name: "På förslag" })).toBeVisible();
  await page.goto("/exempel");

  const alternative = page.locator('[data-next-stop-proposal="alternative"]').filter({
    hasText: "Kardemummaköket",
  });
  await expect(alternative).toBeVisible();
  await expect(alternative.getByText("På tur", { exact: true })).toBeVisible();
  await expect(alternative.getByRole("button", { name: "Gör till nästa stopp" })).toBeVisible();
  await expect(alternative.getByRole("link", { name: "Öppna Kardemummaköket" })).toBeVisible();
  await expect(alternative.getByText(/Jag vill hit|Flest vill hit|Till stället/)).toHaveCount(0);
  await expect(page.getByText("3 på tur", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("4 av 4");

  const labels = await page
    .getByLabel("Välj ställe i kön")
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(labels).toEqual([
    "Visa nästa stopp: Gröna Terrassen",
    "Visa ställe på tur: Rundans Bistro",
    "Visa ställe på tur: Tacoateljén",
    "Visa ställe på tur: Kardemummaköket",
  ]);
  await expectNoOverflow(page);
});

test("karusellen glider med horisontell scroll-snap och tydliga overlay-pilar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const viewport = page.getByTestId("next-stop-carousel-viewport");
  await expect(viewport).toHaveCSS("scroll-snap-type", /x/);
  await expect(page.getByRole("button", { name: /Nästa ställe i kön:/ })).toBeVisible();

  await page.getByRole("button", { name: /Nästa ställe i kön:/ }).click();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 3");
  await expect(
    page.locator('[data-next-stop-proposal="alternative"]').filter({
      hasText: "Rundans Bistro",
    }),
  ).toBeVisible();
  const secondPosition = await viewport.evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    width: element.clientWidth,
  }));
  expect(secondPosition.scrollLeft).toBeGreaterThan(secondPosition.width * 0.9);

  await page.getByRole("button", { name: /Föregående ställe i kön:/ }).click();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 3");
  const firstScrollLeft = await viewport.evaluate((element) => element.scrollLeft);
  expect(firstScrollLeft).toBeLessThan(20);
  await expectNoOverflow(page);
});

test("Gör till nästa stopp flyttar fram stället men behåller resten av kön och dagen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await ensureDay(page);
  const beforeDay = await dayRow(page).getAttribute("aria-label");

  await page.getByRole("button", { name: "Visa ställe på tur: Tacoateljén" }).click();
  const alternative = page.locator('[data-next-stop-proposal="alternative"]').filter({
    hasText: "Tacoateljén",
  });
  await alternative.getByRole("button", { name: "Gör till nästa stopp" }).click();

  const switchDialog = page.getByRole("dialog", {
    name: "Göra Tacoateljén till nästa stopp?",
  });
  await expect(switchDialog).toContainText(
    "Tacoateljén flyttas fram som gruppens nästa stopp. Gröna Terrassen ligger kvar på tur.",
  );
  await expect(switchDialog).toContainText("gruppens svar följer med");
  await switchDialog.getByRole("button", { name: "Gör till nästa stopp" }).click();

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByRole("heading", { name: "Tacoateljén" })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 3");
  await expect(dayRow(page)).toHaveAttribute("aria-label", beforeDay ?? "");

  const labels = await page
    .getByLabel("Välj ställe i kön")
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(labels).toEqual([
    "Visa nästa stopp: Tacoateljén",
    "Visa ställe på tur: Gröna Terrassen",
    "Visa ställe på tur: Rundans Bistro",
  ]);
  await expectNoOverflow(page);
});

test("Registrera besök från Nästa stopp avancerar kön och nollställer gammal dag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await expect(dayRow(page)).toBeVisible();

  await registerScorelessVisit(page, "Registrera besök");
  await expect(page.getByText("Besök registrerat")).toBeVisible();

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByRole("heading", { name: "Rundans Bistro" })).toBeVisible();
  await expect(page.getByText("1 på tur", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 2");
  await expect(dayRow(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Föreslå dag" })).toBeVisible();
  await expectNoOverflow(page);
});

test("ett spontant besök på ett ställe På tur påverkar inte kön", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await page.goto("/matstallen/p1");
  await registerScorelessVisit(page, /Registrera besök/);
  await page.goto("/exempel");

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByRole("heading", { name: "Gröna Terrassen" })).toBeVisible();
  await expect(page.getByText("2 på tur", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Visa ställe på tur: Rundans Bistro" }).click();
  await expect(
    page.locator('[data-next-stop-proposal="alternative"]').filter({ hasText: "Rundans Bistro" }),
  ).toBeVisible();
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

test("passerad dag frågar vad som hände utan att återinföra tid", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await page.evaluate((date) => {
    window.sessionStorage.setItem(
      "matrundan.nextStop.v2.example-stockholm",
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
