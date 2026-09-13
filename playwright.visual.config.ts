import { defineConfig, devices } from "@playwright/test";

import { workChromiumLaunchOptions } from "./scripts/work-browser-config";

const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const e2eSupabaseUrl = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const e2eSupabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_matrundan_e2e";
const chromiumLaunchOptions = workChromiumLaunchOptions();

export default defineConfig({
  testDir: "./tests/visual-review",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: chromiumLaunchOptions ? 1 : undefined,
  retries: 0,
  reporter: "line",
  outputDir: "visual-review/test-results",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "off",
    trace: "off",
  },
  webServer: {
    command: "bun run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...inheritedEnvironment,
      VITE_SUPABASE_URL: e2eSupabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: e2eSupabasePublishableKey,
    },
  },
  projects: [
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
        launchOptions: chromiumLaunchOptions,
      },
    },
    {
      name: "desktop-1280",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        launchOptions: chromiumLaunchOptions,
      },
    },
  ],
});
