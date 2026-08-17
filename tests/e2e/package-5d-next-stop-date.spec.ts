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

function focusedActionsTrigger(page: Page) {
  return page.getByRole("button", { name: "Fler val för nästa stopp" });
}

async function addDay(page: Page, date: string) {
  await page.getByRole("button", { name: "Lägg till dag" }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till dag" });
  await expect(addDialog.getByLabel("Tid")).toHaveCount(0);
  await addDialog.getByLabel("Dag").fill(date);
  await addDialog.getByRole("button", { name: "Spara" }).click();
  await expect(focusedActionsTrigger(page)).toBeVisible();
}

async function expectNoOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test("första förslaget är nästa stopp och ett nytt förslag bevaras som alternativ", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  await expect(focused.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(page.getByText("Johan föreslog", { exact: true })).toBeVisible();
  await expect(page.getByText(/går gärna hit/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Slumpa förslag" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bestäm/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ändra nästa stopp" })).toHaveCount(0);

  await proposeAlternativeFromDetail(page);

  await expect(
    page.locator('[data-next-stop-proposal="selected"]').getByText("Glöd & Grönska", {
      exact: true,
    }),
  ).toBeVisible();
  const otherProposals = page.getByRole("button", { name: "Andra förslag (1)" });
  await expect(otherProposals).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Lilla Myntans Matrum", { exact: true })).toHaveCount(0);

  await otherProposals.click();
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  await expect(alternative.getByText("Lilla Myntans Matrum", { exact: true })).toBeVisible();
  await expect(alternative.getByText(/föreslog/i)).toBeVisible();
  await expect(alternative.getByRole("button", { name: /Går gärna hit/ })).toBeVisible();
  await expect(alternative.getByRole("button", { name: "Välj ställe" })).toBeVisible();

  await expectNoOverflow(page);
});

test("Går gärna hit är samma lätta signal på fokus och alternativ", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const focusedSupport = page.getByRole("button", { name: /Går gärna hit/ }).first();
  await expect(focusedSupport).toBeVisible();

  await page.getByRole("button", { name: "Andra förslag (1)" }).click();
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  const support = alternative.getByRole("button", { name: /Går gärna hit/ });
  await support.click();
  await expect(support).toHaveAttribute("aria-pressed", "true");
  await expect(alternative.getByText(/föreslog/i)).toBeVisible();

  await expectNoOverflow(page);
});

test("Välj ställe byter nästa stopp utan att skapa ett separat öppet val", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  await page.getByRole("button", { name: "Andra förslag (1)" }).click();
  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  await alternative.getByRole("button", { name: "Välj ställe" }).click();

  const dialog = page.getByRole("dialog", { name: "Byt nästa stopp?" });
  await expect(dialog).toContainText("Lilla Myntans Matrum");
  await expect(dialog).toContainText("Glöd & Grönska");
  await dialog.getByRole("button", { name: "Ja, byt nästa stopp" }).click();

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  await expect(focused.getByText("Lilla Myntans Matrum", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bestäm/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ändra nästa stopp" })).toHaveCount(0);

  const otherProposals = page.getByRole("button", { name: "Andra förslag (1)" });
  await otherProposals.click();
  await expect(
    page.locator('[data-next-stop-proposal="alternative"]').getByText("Glöd & Grönska", {
      exact: true,
    }),
  ).toBeVisible();

  await expectNoOverflow(page);
});

test("Slumpa förslag lägger till ett alternativ utan att skriva över nästa stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const before = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("link")
    .last()
    .textContent();
  await page.getByRole("button", { name: "Slumpa förslag" }).click();

  await expect(page.getByRole("button", { name: "Andra förslag (1)" })).toBeVisible();
  const after = await page
    .locator('[data-next-stop-proposal="selected"]')
    .getByRole("link")
    .last()
    .textContent();
  expect(after).toBe(before);
  await expectNoOverflow(page);
});

test("matställedetaljen skapar ett alternativ utan att ersätta nästa stopp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  await proposeAlternativeFromDetail(page);

  const focused = page.locator('[data-next-stop-proposal="selected"]');
  await expect(focused.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Andra förslag (1)" })).toBeVisible();
});

test("nästa stopp använder bara dag och aldrig klockslag", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  const firstDate = futureDate(10);
  const changedDate = futureDate(12);

  await addDay(page, firstDate);
  await expect(page.getByText(/18:30|19:15/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Lägg till tid|Ändra tid/ })).toHaveCount(0);
  await expect(focusedActionsTrigger(page)).toHaveCount(1);

  const trigger = focusedActionsTrigger(page);
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Ändra dag" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /tid/i })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Ändra dag" }).click();

  const dateDialog = page.getByRole("dialog", { name: "Ändra dag" });
  await dateDialog.getByLabel("Dag").fill(changedDate);
  await dateDialog.getByRole("button", { name: "Spara" }).click();

  await page.reload();
  await expect(focusedActionsTrigger(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /tid/i })).toHaveCount(0);
  await expectNoOverflow(page);
});

test("passerad dag frågar vad som hände och Det blev inte av behåller nästa stopp", async ({
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
  const focused = page.locator('[data-next-stop-proposal="selected"]');
  await expect(focused.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});
