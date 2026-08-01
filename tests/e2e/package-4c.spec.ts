import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    metrics.documentScrollWidth,
    `${context}: dokumentet får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.documentClientWidth);
  expect(
    metrics.bodyScrollWidth,
    `${context}: body får inte ha horisontell overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth);
}

async function removeCurrentPlace(page: Page) {
  await page.getByRole("button", { name: "Hantera ställe" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ta bort från gruppen" }).click();
}

test("ställe utan besök tas bort från aktiva flöden och kan läggas tillbaka utan tappad metadata", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const note = "Nästa stopp? Menyn ser ut att passa hela gänget.";
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen/p5?demo=1");

  await removeCurrentPlace(page);
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "Stället tas bort från gruppens lista. Du kan lägga till det igen senare.",
  );
  await confirm.getByRole("button", { name: "Ta bort från gruppen" }).click();

  await expect(
    page.getByText("Inte längre i gruppens lista", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator("p").filter({ hasText: note })).toHaveText(note);
  await expect(page.getByText(/kanonisk/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Borttaget matställe utan besök");

  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { name: "Vart går rundan härnäst?" })).toBeVisible();
  const activeTile = page.getByText("Ställen", { exact: true }).locator("..");
  await expect(activeTile.getByText("8", { exact: true })).toBeVisible();

  await page.goto("/matstallen?demo=1");
  await expect(page.getByText("Glöd & Grönska", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Arkiverade ställen", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await addDialog.getByRole("button", { name: "Lägg till manuellt" }).click();
  await addDialog.getByLabel("Namn").fill("Glöd & Grönska");
  await addDialog.getByLabel("Adress").fill("Grönskans gränd 3");
  await addDialog.getByRole("button", { name: "Passar för: Något extra", exact: true }).click();
  await addDialog.getByRole("button", { name: "Lägg till", exact: true }).click();

  const restoredLink = page.getByRole("link", { name: /Glöd & Grönska/ });
  await expect(restoredLink).toHaveCount(1);
  await restoredLink.click();
  await expect(page.locator("p").filter({ hasText: note })).toHaveText(note);
  await expect(page.getByText("Vegetariskt/veganskt", { exact: true })).toBeVisible();
  await expect(page.getByText("Grillat", { exact: true })).toBeVisible();
  await expect(page.getByText("Något extra", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrera besök" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "Återlagt matställe via vanliga Lägg till");
});

test("ställe med besök behåller historiken när det tas bort", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen/p2?demo=1");

  await removeCurrentPlace(page);
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "Stället tas bort från gruppens lista. Tidigare besök och omdömen finns kvar i historiken, och du kan lägga till stället igen senare.",
  );
  await confirm.getByRole("button", { name: "Ta bort från gruppen" }).click();

  await expect(
    page.getByText("Inte längre i gruppens lista", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Besök (3)" })).toBeVisible();
  await page
    .getByRole("button", { name: /Öppna besök av/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Kvarterets Kardemumma" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "Historik för borttaget matställe");
});

test("kök och inriktning fungerar med mobilt tangentbord och utan fri text", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/matstallen?demo=1");

  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await dialog.getByRole("button", { name: "Lägg till manuellt" }).click();
  await dialog.getByRole("combobox", { name: "Kök och inriktning" }).click();

  const drawer = page.getByRole("dialog", { name: "Kök och inriktning" });
  const search = drawer.getByPlaceholder("Sök kök eller inriktning…");
  await expect(drawer).toBeVisible();
  await search.focus();

  // Efterliknar den minskade visuella viewporten när ett mobilt tangentbord öppnas.
  await page.setViewportSize({ width: 360, height: 480 });
  await expect
    .poll(async () => {
      const box = await drawer.boundingBox();
      return box ? Math.ceil(box.y + box.height) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(481);
  await expect(search).toBeVisible();
  await expectNoHorizontalOverflow(page, "Öppen köksväljare med reducerad mobilhöjd");

  await search.fill("japan");
  await drawer.getByRole("option", { name: "Japanskt" }).click();
  await search.fill("sushi");
  await drawer.getByRole("option", { name: "Sushi" }).click();
  await search.fill("egen påhittad etikett");
  await expect(drawer.getByText("Ingen matchande etikett.")).toBeVisible();
  await drawer.getByRole("button", { name: "Klar" }).click();

  await expect(dialog.getByText("Japanskt", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Sushi", { exact: true })).toBeVisible();
  await expect(dialog.getByText("egen påhittad etikett", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "Sökbar multiväljare");
});
