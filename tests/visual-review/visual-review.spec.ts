import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATHS = ["/?demo=1", "/matstallen?demo=1", "/matstallen/p7?demo=1"];

function getReviewPaths() {
  const configured = process.env.VISUAL_REVIEW_PATHS?.trim();
  if (!configured) return DEFAULT_PATHS;

  const paths = configured
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith("/") ? value : `/${value}`));

  return paths.length > 0 ? paths : DEFAULT_PATHS;
}

function screenshotName(route: string) {
  const parsed = new URL(route, "http://visual-review.local");
  const pathname = parsed.pathname === "/" ? "hem" : parsed.pathname.slice(1);
  const query = parsed.searchParams.toString();
  const raw = query ? `${pathname}-${query}` : pathname;

  return raw
    .replace(/[^a-zA-Z0-9åäöÅÄÖ]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

for (const route of getReviewPaths()) {
  test(`fånga ${route}`, async ({ page }, testInfo) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible();

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
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.scrollTo(0, 0);
    });

    const outputDirectory = path.join("visual-review", testInfo.project.name);
    await mkdir(outputDirectory, { recursive: true });

    await page.screenshot({
      path: path.join(outputDirectory, `${screenshotName(route)}.png`),
      fullPage: true,
    });
  });
}
