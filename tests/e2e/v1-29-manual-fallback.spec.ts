import { expect, test, type Page } from "@playwright/test";

async function openSearchDialog(page: Page) {
  await page.goto("/matstallen?demo=1");
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  const addPlace = page.getByRole("button", { name: /lägg till ställe/i }).first();
  await expect(addPlace).toBeVisible();
  await addPlace.click();
  await expect(page.getByRole("heading", { name: "Lägg till matställe" })).toBeVisible();
}

async function openExampleSearchDialog(page: Page) {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen");
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  const addPlace = page.getByRole("button", { name: /lägg till ställe/i }).first();
  await expect(addPlace).toBeVisible();
  await addPlace.click();
  await expect(page.getByRole("heading", { name: "Lägg till matställe" })).toBeVisible();
}

function fallbackButton(page: Page) {
  return page.getByRole("button", { name: "Lägg till ett ställe som saknas", exact: true });
}

function manualForm(page: Page) {
  return page.locator("#manual-name");
}

test("sista sökområdes-pillen kan tas bort på mobil utan att fallbackformuläret öppnas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSearchDialog(page);

  await expect(fallbackButton(page)).toBeVisible();
  await expect(manualForm(page)).toHaveCount(0);

  const pills = page.getByRole("list", { name: "Valda sökområden" }).getByRole("listitem");
  while ((await pills.count()) > 0) {
    await pills.first().getByRole("button").tap();
    await page.waitForTimeout(150);
  }

  for (let step = 0; step < 10; step += 1) {
    await expect(manualForm(page)).toHaveCount(0);
    await expect(fallbackButton(page)).toBeVisible();
    await page.waitForTimeout(80);
  }

  await expect(page.getByText("Sök och välj minst ett sökområde.")).toBeVisible();
});

test("spökklick utan pekning öppnar inte fallbacken men en riktig aktivering gör det", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSearchDialog(page);

  await fallbackButton(page).evaluate((element: HTMLElement) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
  await page.waitForTimeout(200);

  await expect(manualForm(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Lägg till matställe" })).toBeVisible();

  await fallbackButton(page).tap();
  await expect(page.getByRole("heading", { name: "Stället saknas i sökningen" })).toBeVisible();
  await expect(manualForm(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tillbaka till sök" })).toBeVisible();
});

test("exempelgruppen återanvänder ett arkiverat kanoniskt ställe med samma placeId", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openExampleSearchDialog(page);
  await fallbackButton(page).tap();

  await manualForm(page).fill("Brödverket 47");
  const location = page.locator("#manual-location");
  await location.fill("Degvägen 47");

  const option = page.getByRole("option").filter({ hasText: "Degvägen 47" }).first();
  await expect(option).toBeVisible();
  await option.getByRole("button").click();

  await expect(page.getByText("Finns redan i Matrundan")).toBeVisible();
  const restore = page.getByRole("button", { name: "Lägg tillbaka", exact: true });
  await expect(restore).toBeVisible();
  await restore.click();

  await expect(page.getByText("Brödverket 47 lades tillbaka i gruppen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lägg till matställe" })).toHaveCount(0);
});
