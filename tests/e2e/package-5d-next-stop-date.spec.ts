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

test("alternativ läggs till utan att skriva över nästa stopp och kan väljas uttryckligen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  const selectedCard = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selectedCard.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(selectedCard.getByText("Nästa stopp", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Slumpa förslag" }).click();
  await expect(page.locator('[data-next-stop-proposal="open"]')).toHaveCount(1);
  await expect(selectedCard.getByText("Glöd & Grönska", { exact: true })).toBeVisible();

  const alternative = page.locator('[data-next-stop-proposal="open"]');
  await alternative.getByRole("button", { name: "Gärna", exact: true }).click();
  await expect(alternative.getByRole("button", { name: "Gärna!", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(alternative.getByText("1 vill gärna hit", { exact: true })).toBeVisible();

  await alternative.getByRole("button", { name: "Välj som nästa stopp" }).click();
  const dialog = page.getByRole("dialog", { name: "Bestäm nästa stopp" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ja, bestäm nästa stopp" }).click();

  await expect(page.locator('[data-next-stop-proposal="selected"]')).toHaveCount(1);
  await expect(page.locator('[data-next-stop-proposal="open"]')).toHaveCount(1);

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test("matställedetaljen skapar ett förslag även i demo utan att ersätta valt stopp", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);

  await page.goto("/matstallen/p1?demo=1");
  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  await expect(page.getByRole("button", { name: "På förslag" })).toBeVisible();

  await page.goto("/?demo=1");
  const selectedCard = page.locator('[data-next-stop-proposal="selected"]');
  const openCard = page.locator('[data-next-stop-proposal="open"]');
  await expect(selectedCard.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(openCard).toHaveCount(1);
  await expect(openCard.getByText("Lilla Napoli", { exact: true })).toBeVisible();

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test("gruppen kan sätta gemensam dag med valfri tid och ändra den utan Doodle-flöde", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page);
  const firstDate = futureDate(10);
  const changedDate = futureDate(12);

  await page.getByRole("button", { name: "Lägg till dag" }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till dag" });
  await dialog.getByLabel("Dag").fill(firstDate);
  await dialog.getByLabel("Tid (valfritt)").fill("18:30");
  await dialog.getByRole("button", { name: "Spara" }).click();

  await expect(page.getByText("kl. 18:30")).toBeVisible();
  await page.getByRole("button", { name: "Ändra dag" }).click();
  const editDialog = page.getByRole("dialog", { name: "Ändra dag" });
  await editDialog.getByLabel("Dag").fill(changedDate);
  await editDialog.getByLabel("Tid (valfritt)").fill("");
  await editDialog.getByRole("button", { name: "Spara" }).click();

  await expect(page.getByText("kl. 18:30")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ändra dag" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Ändra dag" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test("passerad dag frågar vad som faktiskt hände utan att skapa historik automatiskt", async ({
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
  await page.getByRole("button", { name: "Nej, det blev inte av" }).click();

  await expect(page.getByRole("heading", { name: "Blev det av?" })).toHaveCount(0);
  const selectedCard = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selectedCard.getByText("Glöd & Grönska", { exact: true })).toBeVisible();
  await expect(selectedCard.getByText("Nästa stopp", { exact: true })).toBeVisible();
});
