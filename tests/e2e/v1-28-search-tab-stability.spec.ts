import { expect, test, type Page } from "@playwright/test";

async function openSearchDialog(page: Page) {
  await page.goto("/matstallen?demo=1");
  await expect(page.getByRole("heading", { name: "Matställen" })).toBeVisible();
  const addPlace = page.getByRole("button", { name: /lägg till ställe/i }).first();
  await expect(addPlace).toBeVisible();
  await addPlace.click();
  await expect(page.getByRole("heading", { name: "Lägg till matställe" })).toBeVisible();
}

function searchTab(page: Page) {
  return page.getByRole("button", { name: "Sök", exact: true });
}

function manualTab(page: Page) {
  return page.getByRole("button", { name: "Lägg till manuellt", exact: true });
}

function manualForm(page: Page) {
  return page.locator("#manual-name");
}

test("sista sökområdes-pillen kan tas bort på mobil utan att manuella formuläret visas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSearchDialog(page);

  await expect(searchTab(page)).toHaveAttribute("aria-pressed", "true");

  const pills = page.getByRole("list", { name: "Valda sökområden" }).getByRole("listitem");
  while ((await pills.count()) > 0) {
    await pills.first().getByRole("button").tap();
    await page.waitForTimeout(150);
  }

  for (let step = 0; step < 10; step += 1) {
    await expect(manualForm(page)).toHaveCount(0);
    await expect(searchTab(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(80);
  }

  await expect(page.getByText("Sök och välj minst ett sökområde.")).toBeVisible();
});

test("spökklick utan pekning aktiverar inte manuella formuläret", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSearchDialog(page);

  await manualTab(page).evaluate((element: HTMLElement) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
  await page.waitForTimeout(200);

  await expect(manualForm(page)).toHaveCount(0);
  await expect(searchTab(page)).toHaveAttribute("aria-pressed", "true");

  await manualTab(page).tap();
  await expect(manualForm(page)).toBeVisible();
});
