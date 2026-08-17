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

test("hybridkortet behåller v1-hierarkin men flera ställesförslag", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  await expect(focused).toBeVisible();
  await expect(focused.getByText(/föreslog/i)).toBeVisible();
  await expect(focused.getByRole("button", { name: /Jag vill hit/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa förslag" })).toBeVisible();
  await expect(page.getByText(/Går gärna hit/i)).toHaveCount(0);
  await expect(page.getByText(/18:30|19:15/)).toHaveCount(0);

  await proposeAlternativeFromDetail(page);
  const accordion = page.getByRole("button", { name: /Andra förslag \(1\)/ });
  await expect(accordion).toHaveAttribute("aria-expanded", "false");
  await accordion.click();

  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  await expect(alternative.getByText(/föreslog/i)).toBeVisible();
  await expect(alternative.getByRole("button", { name: /Jag vill hit/ })).toBeVisible();
  await expect(alternative.getByRole("button", { name: "Välj ställe" })).toBeVisible();
  await expectNoOverflow(page);
});

test("Jag vill hit kan markeras på både fokus och alternativ utan att byta stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  const beforeName = await focused.getByRole("heading").textContent();
  const focusedSupport = focused.getByRole("button", { name: /Jag vill hit/ });
  if ((await focusedSupport.getAttribute("aria-pressed")) !== "true") await focusedSupport.click();
  await expect(focusedSupport).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Andra förslag \(1\)/ }).click();
  const alternativeSupport = page
    .locator('[data-next-stop-proposal="alternative"]')
    .getByRole("button", { name: /Jag vill hit/ });
  if ((await alternativeSupport.getAttribute("aria-pressed")) !== "true") await alternativeSupport.click();
  await expect(alternativeSupport).toHaveAttribute("aria-pressed", "true");

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

  await dayRow(page).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Kan du den dagen?", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Jag kan" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Jag kan inte" })).toBeVisible();
  await expect(sheet.getByText(/Osäker/i)).toHaveCount(0);
  await expect(sheet.getByText(/18:30|19:15/)).toHaveCount(0);

  const canButton = sheet.getByRole("button", { name: "Jag kan" });
  if ((await canButton.getAttribute("aria-pressed")) !== "true") await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByText(/Kan:/)).toBeVisible();
  await expectNoOverflow(page);
});

test("föreslå annan dag nollställer gruppens dagsvar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await dayRow(page).click();
  let sheet = page.getByRole("dialog");
  const canButton = sheet.getByRole("button", { name: "Jag kan" });
  if ((await canButton.getAttribute("aria-pressed")) !== "true") await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");

  await sheet.getByRole("button", { name: "Föreslå annan dag" }).click();
  const dateDialog = page.getByRole("dialog", { name: "Föreslå annan dag" });
  await dateDialog.getByLabel("Dag").fill(futureDate(14));
  await dateDialog.getByRole("button", { name: "Spara" }).click();

  await dayRow(page).click();
  sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Jag kan" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(sheet.getByText("Ingen har svarat än.", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("Välj ställe bevarar dag, dagsvar och platsintresse men flyttar fokus", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const beforeName = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  const beforeDay = await dayRow(page).getAttribute("aria-label");

  await dayRow(page).click();
  let sheet = page.getByRole("dialog");
  const canButton = sheet.getByRole("button", { name: "Jag kan" });
  if ((await canButton.getAttribute("aria-pressed")) !== "true") await canButton.click();
  await expect(canButton).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Andra förslag \(1\)/ }).click();
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  const support = alternative.getByRole("button", { name: /Jag vill hit/ });
  if ((await support.getAttribute("aria-pressed")) !== "true") await support.click();
  await expect(support).toHaveAttribute("aria-pressed", "true");

  await alternative.getByRole("button", { name: "Välj ställe" }).click();
  const switchDialog = page.getByRole("dialog", { name: "Välj det här stället?" });
  await expect(switchDialog).toContainText("Dagen, dagsvaren och allas Jag vill hit-markeringar ligger kvar");
  await switchDialog.getByRole("button", { name: "Välj ställe" }).click();

  const afterName = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  expect(afterName).not.toBe(beforeName);
  await expect(dayRow(page)).toHaveAttribute("aria-label", beforeDay ?? "");
  await expect(
    page.locator('[data-next-stop-proposal="selected"]').getByRole("button", { name: /Jag vill hit/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await dayRow(page).click();
  sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Jag kan" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoOverflow(page);
});

test("Slumpa förslag lägger till alternativ utan att skriva över nästa stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const before = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  await page.getByRole("button", { name: "Slumpa förslag" }).click();

  await expect(page.getByRole("button", { name: /Andra förslag \(1\)/ })).toBeVisible();
  const after = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  expect(after).toBe(before);
  await expectNoOverflow(page);
});

test("matställedetaljen skapar ett alternativ utan att ersätta nästa stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  const before = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();

  await proposeAlternativeFromDetail(page);

  const after = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("heading")
    .textContent();
  expect(after).toBe(before);
  await expect(page.getByRole("button", { name: /Andra förslag \(1\)/ })).toBeVisible();
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
