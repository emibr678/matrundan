import { expect, test } from "@playwright/test";

test("lösenordsåterställning utan aktiv recovery-session visar säkert fallbackläge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/nytt-losenord");

  await expect(page.getByRole("heading", { name: "Välj nytt lösenord" })).toBeVisible();
  await expect(
    page.getByText(
      "Länken är slut eller har redan använts. Begär en ny återställningslänk från inloggningen.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Till Matrundan" })).toBeVisible();
  await expect(page.getByLabel("Nytt lösenord")).toHaveCount(0);

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});
