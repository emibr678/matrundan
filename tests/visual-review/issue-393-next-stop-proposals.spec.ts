import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
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

async function captureElement(element: Locator, testInfo: TestInfo, name: string) {
  const outputDirectory = path.join("visual-review", testInfo.project.name);
  await mkdir(outputDirectory, { recursive: true });
  await element.screenshot({ path: path.join(outputDirectory, `${name}.png`) });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

async function expectCarouselIndex(page: Page, index: number) {
  const viewport = page.getByTestId("next-stop-carousel-viewport");
  await expect
    .poll(() =>
      viewport.evaluate((element) =>
        element.clientWidth ? Math.round(element.scrollLeft / element.clientWidth) : -1,
      ),
    )
    .toBe(index);
}

async function resetDemo(page: Page) {
  await page.goto("/exempel", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    window.sessionStorage.removeItem("matrundan.exampleState.v4");
    window.sessionStorage.setItem("matrundan.exampleSession.v1", "1");
    window.localStorage.removeItem("matrundan.nextStop.v2.g1");
    window.localStorage.removeItem("matrundan.nextStop.v2.responses.g1");
    window.localStorage.removeItem("matrundan.nextStopDate.v1.g1");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.example-stockholm");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.responses.example-stockholm");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.reveal");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

test("fånga nästa stopp och mjuk kö", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await resetDemo(page);

  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected.getByText("Nästa stopp", { exact: true })).toBeVisible();
  await expect(page.getByText("2 på tur", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("1 av 3");
  await expect(page.getByRole("button", { name: /Nästa ställe i kön:/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-393-ko-nasta-stopp");

  await page.getByRole("button", { name: "Visa ställe på tur: Rundans Bistro" }).click();
  await expectCarouselIndex(page, 1);
  const queued = page
    .locator('[data-next-stop-proposal="alternative"]')
    .filter({ has: page.getByRole("heading", { name: "Rundans Bistro", exact: true }) });
  await expect(queued.getByText("På tur", { exact: true })).toBeVisible();
  await expect(queued.getByText("På tur efter Gröna Terrassen", { exact: true })).toBeVisible();
  await expect(
    queued.getByText("Kön flyttas fram när nästa stopp är avklarat.", { exact: true }),
  ).toBeVisible();
  await expect(queued.getByRole("button", { name: "Gör till nästa stopp" })).toBeVisible();
  await expect(queued.getByText(/Jag vill hit|Flest vill hit|Till stället/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await captureElement(queued, testInfo, "issue-393-ko-pa-tur-kort");
});

test("fånga nytt förslag sist på tur", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await resetDemo(page);
  await page.goto("/matstallen/p2", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  await expect(page.getByRole("button", { name: "På förslag" })).toBeVisible();
  await page.goto("/exempel", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("3 på tur", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("4 av 4");
  await expectCarouselIndex(page, 3);
  const newest = page
    .locator('[data-next-stop-proposal="alternative"]')
    .filter({ has: page.getByRole("heading", { name: "Kardemummaköket", exact: true }) });
  await expect(newest).toBeVisible();
  await expect(newest.getByText("På tur efter Tacoateljén", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureElement(newest, testInfo, "issue-393-ko-nytt-sist-kort");
});
