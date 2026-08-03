import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth, `${context}: ingen horisontell overflow`).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

async function openExampleGroup(page: Page) {
  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/gruppen");
  await expect(page.getByRole("heading", { name: "Fredagsgänget" })).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  await expect(settings).toBeVisible();
  return settings;
}

test("exempelgruppen använder samma medlemsprofil och rollhantering som live", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openExampleGroup(page);

  let settings = await openSettings(page);
  const profileButton = settings.getByRole("button", { name: "Öppna profil för Robin" });
  const manageButton = settings.getByRole("button", { name: "Hantera Robin" });
  await expect(profileButton).toBeVisible();
  await expect(manageButton).toBeVisible();

  for (const [name, button] of [
    ["profilraden", profileButton],
    ["Hantera", manageButton],
  ] as const) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0, `${name} ska ha minst 44 px tryckyta`).toBeGreaterThanOrEqual(44);
  }

  await profileButton.click();
  const profile = page.getByRole("dialog", { name: "Robin", exact: true });
  await expect(profile.getByRole("heading", { name: "Robin", exact: true })).toBeVisible();
  await expect(profile.getByText("Deltagna besök", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeVisible();

  await manageButton.click();
  await page.getByRole("menuitem", { name: "Gör till administratör" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Gör Robin till administratör?",
  });
  await confirmation.getByRole("button", { name: "Gör till administratör" }).click();
  await expect(page.getByText("Robin är nu administratör.", { exact: true })).toBeVisible();

  settings = await openSettings(page);
  const updatedRobin = settings.getByRole("button", { name: "Öppna profil för Robin" });
  await expect(updatedRobin).toContainText(/admin/i);
  await settings.getByRole("button", { name: "Hantera Robin" }).click();
  await expect(page.getByRole("menuitem", { name: "Gör till medlem" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.reload();
  settings = await openSettings(page);
  await expect(settings.getByRole("button", { name: "Öppna profil för Robin" })).toContainText(
    /admin/i,
  );
  await expectNoHorizontalOverflow(page, "exempelgruppens medlemshantering");
});
