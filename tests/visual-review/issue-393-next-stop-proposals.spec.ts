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
  await page.goto("/?demo=1", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.removeItem("matrundan.state.v1");
    window.localStorage.removeItem("matrundan.nextStop.v2.g1");
    window.localStorage.removeItem("matrundan.nextStop.v2.responses.g1");
    window.localStorage.removeItem("matrundan.nextStopDate.v1.g1");
    window.sessionStorage.removeItem("matrundan.nextStop.v2.reveal");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function proposeFromDetail(page: Page, placeId: string) {
  await page.goto(`/matstallen/${placeId}?demo=1`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Föreslå som nästa stopp" }).click();
  await expect(page.getByRole("button", { name: "På förslag" })).toBeVisible();
}

test("fånga karusellens nästa stopp och nyss tillagda förslag", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await resetDemo(page);
  await proposeFromDetail(page, "p1");
  await page.goto("/?demo=1", { waitUntil: "domcontentloaded" });

  const alternative = page.locator('[data-next-stop-proposal="alternative"]');
  await expect(alternative).toBeVisible();
  await expect(alternative.getByText("Förslag", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Föregående förslag:/ })).toBeVisible();
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 2");
  await expectCarouselIndex(page, 1);
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-393-karusell-nytt-forslag");

  await page.getByRole("button", { name: /Visa nästa stopp:/ }).click();
  const selected = page.locator('[data-next-stop-proposal="selected"]');
  await expect(selected).toBeVisible();
  await expect(selected.getByText("Valt nästa stopp", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nästa förslag:/ })).toBeVisible();
  await expectCarouselIndex(page, 0);
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-393-karusell-nasta-stopp");
});

test("fånga karusell med flera förslag och nyast först", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await resetDemo(page);
  await proposeFromDetail(page, "p1");
  await proposeFromDetail(page, "p2");
  await proposeFromDetail(page, "p3");
  await page.goto("/?demo=1", { waitUntil: "domcontentloaded" });

  await expect(
    page
      .locator('[data-next-stop-proposal="alternative"]')
      .filter({ hasText: "Månskärans Taquería" }),
  ).toHaveCount(1);
  await expect(page.getByTestId("next-stop-carousel-position")).toHaveText("2 av 4");
  await expectCarouselIndex(page, 1);
  await expect(page.getByText("4 förslag", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-393-karusell-flera-forslag");
});
