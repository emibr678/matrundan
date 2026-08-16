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

function scheduleMenuTrigger(page: Page) {
  return page.getByRole("button", { name: "Ändra dag eller tid" });
}

async function openScheduleMenu(page: Page) {
  await scheduleMenuTrigger(page).click();
  return page.getByRole("menu");
}

async function addDay(page: Page, date: string) {
  await page.getByRole("button", { name: "Lägg till dag" }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till dag" });
  await expect(addDialog.getByLabel("Tid (valfritt)")).toHaveCount(0);
  await addDialog.getByLabel("Dag").fill(date);
  await addDialog.getByRole("button", { name: "Spara" }).click();
  await expect(scheduleMenuTrigger(page)).toBeVisible();
}

async function expectNoOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test("bestämt stopp fokuserar på resultatet och håller andra förslag kollapsade", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa förslag" })).toHaveCount(0);
  await expect(page.getByText("Lilla Myntans Matrum", { exact: true })).toHaveCount(0);

  const otherProposals = page.getByRole("button", { name: "Andra förslag (1)" });
  await expect(otherProposals).toHaveAttribute("aria-expanded", "false");
  await otherProposals.click();
  await expect(otherProposals).toHaveAttribute("aria-expanded", "true");

  const alternative = page.locator('[data-next-stop-proposal="open"]');
  await expect(alternative.getByText("Lilla Myntans Matrum", { exact: true })).toBeVisible();
  await expect(alternative.getByText(/Föreslaget av/)).toHaveCount(0);
  await alternative.getByRole("button", { name: "Går gärna dit" }).click();
  await expect(alternative.getByRole("button", { name: "Går gärna dit" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(alternative.getByText("1 går gärna dit", { exact: true })).toBeVisible();

  await alternative.getByRole("button", { name: "Byt till", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Byt nästa stopp" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ja, byt nästa stopp" }).click();

  const newSelected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(newSelected.getByText("Lilla Myntans Matrum", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa förslag" })).toHaveCount(0);

  await expectNoOverflow(page);
});

test("Ändra nästa stopp öppnar alternativen utan att skriva över dem", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  await page.getByRole("button", { name: "Ändra nästa stopp" }).click();

  await expect(page.locator('[data-next-stop-proposal="selected"]')).toHaveCount(0);
  await expect(page.locator('[data-next-stop-proposal="open"]')).toHaveCount(2);
  await expect(page.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(page.getByText("Lilla Myntans Matrum", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa förslag" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bestäm", exact: true }).first()).toBeVisible();

  await expectNoOverflow(page);
});

test("matställedetaljen skapar ett förslag utan att ersätta valt stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Andra förslag (1)" })).toBeVisible();
});

test("dagen visas som lugn metadata och ändras bakom en enda kontroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  const firstDate = futureDate(10);
  const changedDate = futureDate(12);

  await addDay(page, firstDate);
  await expect(page.getByText(/Kan inte den dagen/)).toHaveCount(0);

  const menu = await openScheduleMenu(page);
  await menu.getByRole("menuitem", { name: "Ändra dag" }).click();
  const dateDialog = page.getByRole("dialog", { name: "Ändra dag" });
  await dateDialog.getByLabel("Dag").fill(changedDate);
  await dateDialog.getByRole("button", { name: "Spara" }).click();

  await expect(scheduleMenuTrigger(page)).toBeVisible();
  await page.reload();
  await expect(scheduleMenuTrigger(page)).toBeVisible();

  await expectNoOverflow(page);
});

test("klockslag går bara att lägga till efter att stopp och dag finns", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till dag" })).toBeVisible();

  await addDay(page, futureDate(9));

  const menu = await openScheduleMenu(page);
  await menu.getByRole("menuitem", { name: "Lägg till tid" }).click();
  const timeDialog = page.getByRole("dialog", { name: "Lägg till tid" });
  await timeDialog.getByLabel("Tid").fill("18:30");
  await timeDialog.getByRole("button", { name: "Spara" }).click();

  await expect(page.getByText(/· 18:30/)).toBeVisible();
  await expectNoOverflow(page);

  // Ändra nästa stopp rensar tiden men behåller dagen.
  await page.getByRole("button", { name: "Ändra nästa stopp" }).click();
  await expect(page.getByText(/· 18:30/)).toHaveCount(0);
  const openMenu = await openScheduleMenu(page);
  await expect(openMenu.getByRole("menuitem", { name: "Lägg till tid" })).toHaveCount(0);
  await expect(openMenu.getByRole("menuitem", { name: "Ändra dag" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expectNoOverflow(page);
});

test("direkt byte av bestämt stopp behåller dag och tid", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);
  await addDay(page, futureDate(11));

  const menu = await openScheduleMenu(page);
  await menu.getByRole("menuitem", { name: "Lägg till tid" }).click();
  const timeDialog = page.getByRole("dialog", { name: "Lägg till tid" });
  await timeDialog.getByLabel("Tid").fill("19:15");
  await timeDialog.getByRole("button", { name: "Spara" }).click();
  await expect(page.getByText(/· 19:15/)).toBeVisible();

  await page.getByRole("button", { name: "Andra förslag (1)" }).click();
  const alternative = page.locator('[data-next-stop-proposal="open"]');
  await alternative.getByRole("button", { name: "Byt till", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Byt nästa stopp" });
  await dialog.getByRole("button", { name: "Ja, byt nästa stopp" }).click();

  await expect(
    page.locator('[data-next-stop-proposal="selected"]').getByText("Lilla Myntans Matrum", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/· 19:15/)).toBeVisible();
  await expectNoOverflow(page);
});

test("passerad dag frågar vad som hände och Det blev inte av behåller stället", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await page.evaluate((date) => {
    window.localStorage.setItem(
      "matrundan.nextStop.v2.g1",
      JSON.stringify({
        revision: 3,
        plannedDate: date,
        plannedTime: null,
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
  await expect(page.getByRole("button", { name: "Registrera besöket" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa förslag" })).toHaveCount(0);
  await page.getByRole("button", { name: "Det blev inte av" }).click();

  await expect(page.getByRole("heading", { name: "Blev det av?" })).toHaveCount(0);
  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
});
