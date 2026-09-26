import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const outputDirectory = path.join("visual-review", testInfo.project.name);
  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test("fånga Hem med väntande omdömen och väljaren för flera besök", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/exempel", { waitUntil: "domcontentloaded" });

  const attentionSection = page.getByLabel("Omdömen att komplettera");
  await expect(attentionSection).toBeVisible();
  await expect(attentionSection.getByText("Du har 2 besök att tycka till om")).toBeVisible();
  const attention = attentionSection.getByRole("button", {
    name: "Välj besök att lämna omdöme på",
  });
  await expect(attention).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-415-omdomen-hem");

  await attention.click();
  const chooser = page.getByRole("dialog", { name: "Besök att tycka till om" });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("link")).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-415-omdomen-valjare");
});
