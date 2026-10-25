import { test, expect } from "@playwright/test";

test("exempelgruppens förvalda områden visar Pasta utan sökomväg (#512)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/exempel");
  await page.getByRole("link", { name: "Matställen", exact: true }).click();
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
  await dialog.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Pasta");
  await dialog.getByRole("option").filter({ hasText: "Pasta" }).click();
  await expect(
    dialog.getByRole("button", { name: "Visa information om Skärgårdens Pastakök", exact: true }),
  ).toBeVisible();
  const likely = dialog.getByRole("button", {
    name: "Visa information om Vikens Trattoria",
    exact: true,
  });
  await expect(likely).toBeVisible();
  await expect(likely).toContainText("Italienskt");
  await expect(likely).not.toContainText("Pasta");
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const width of [360, 1280]) {
  test(`sökkatalog, relaterat val och tillägg i demo vid ${width}px (#512)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/matstallen?demo=1");
    await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Lägg till matställe" });
    const query = dialog.getByRole("combobox", { name: "Sök matställen", exact: true });
    await query.fill("Pasta");
    await expect(dialog.getByRole("option").filter({ hasText: "prova Italienskt" })).toHaveCount(0);
    await dialog.getByRole("option").filter({ hasText: "Pasta" }).click();
    await expect(
      dialog.getByRole("button", {
        name: "Visa information om Päronträdets Trattoria",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Visa information om Pizzagläntan", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `visual-review/relevance-pasta-512-${width}.png`,
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Ta bort filtret Pasta", exact: true }).click();
    for (const [word, target] of [
      ["Kyckling", "Kyckling"],
      ["glassbar", "Glass"],
      ["veganskt", "Helt veganskt"],
      ["Brunch", "Café"],
      ["Pizzeria", "Pizza"],
    ]) {
      await query.fill(word);
      const option = dialog
        .getByRole("listbox")
        .getByRole("group", { name: "Kök och typer" })
        .getByRole("option")
        .filter({ hasText: target });
      await expect(option).toHaveCount(1);
      await option.click();
      await expect(dialog.getByTestId("active-place-search-filter")).toContainText(target);
      await expect(query).toHaveValue("");
      if (target === "Helt veganskt")
        await expect(
          dialog.getByText(
            "Avser renodlade matställen enligt platskällan. Menyalternativ räcker inte.",
          ),
        ).toBeVisible();
      await dialog.getByRole("button", { name: `Ta bort filtret ${target}`, exact: true }).click();
    }
    await query.fill("Poké");
    await expect(
      dialog.getByRole("listbox").getByRole("option").filter({ hasText: "Sallad" }),
    ).toHaveCount(0);
    await query.fill("Matvagn");
    await dialog.getByRole("option").filter({ hasText: "Bara kända matvagnar" }).click();
    await expect(
      dialog.getByText("Här visas bara kända matvagnar i Matrundan.", { exact: false }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Sök bredare med Snabbmat", exact: true }).click();
    await expect(dialog.getByTestId("active-place-search-filter")).toContainText("Snabbmat");
    await dialog.getByRole("button", { name: "Ta bort filtret Snabbmat", exact: true }).click();
    // Additional direct concept: source metadata survives the old display normalizer.
    await query.fill("Dumplings");
    await dialog.getByRole("option").filter({ hasText: "Dumplings" }).click();
    const result = dialog.getByRole("button", {
      name: "Visa information om Ångkorgen",
      exact: true,
    });
    await expect(result).toBeVisible();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `visual-review/search-512-${width}.png`, fullPage: true });
    await result.click();
    const details = page.getByRole("dialog", { name: "Lägg till i gruppen" });
    await expect(details).toBeVisible();
    await details.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
    await expect(details).toBeHidden();
    // Name search stays literal after removing a structured choice.
    if (await dialog.isVisible())
      await dialog.getByRole("button", { name: "Stäng", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Matställen", exact: true })).toBeVisible();
    await expect(page.getByText("Ångkorgen", { exact: true })).toBeVisible();
  });
}
