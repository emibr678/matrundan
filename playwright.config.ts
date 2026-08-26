import { defineConfig, devices } from "@playwright/test";

const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const e2eSupabaseUrl = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const e2eSupabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_matrundan_e2e";
const e2eGeoapifyMapsKey = process.env.VITE_GEOAPIFY_MAPS_KEY ?? "matrundan-e2e-map-key";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: process.env.CI ? "./tests/e2e/global-setup.ts" : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...inheritedEnvironment,
      // Generic browser tests exercise landing/demo without a live backend. Keep
      // those tests portable after the tracked .env was removed by the platform migration.
      VITE_SUPABASE_URL: e2eSupabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: e2eSupabasePublishableKey,
      // Map tests intercept Geoapify's style request. A non-secret dummy key keeps
      // the production code path active without making an external request.
      VITE_GEOAPIFY_MAPS_KEY: e2eGeoapifyMapsKey,
    },
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 13"],
      },
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
});
