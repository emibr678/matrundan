import { describe, expect, test } from "bun:test";

import {
  WORK_CHROMIUM_DOWNLOAD,
  WORK_CHROMIUM_VERSION,
  workChromiumLaunchOptions,
} from "../../../scripts/work-browser-config";

describe("Work Chromium configuration", () => {
  test("keeps the optional browser download immutable", () => {
    expect(WORK_CHROMIUM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(WORK_CHROMIUM_DOWNLOAD.url).toContain(`/v${WORK_CHROMIUM_VERSION}/`);
    expect(WORK_CHROMIUM_DOWNLOAD.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("does not override the normal Playwright browser by default", () => {
    expect(workChromiumLaunchOptions({})).toBeUndefined();
  });

  test("returns the verified Work browser override when supplied", () => {
    expect(
      workChromiumLaunchOptions({
        MATRUNDAN_WORK_CHROMIUM_EXECUTABLE_PATH: "/cache/chromium",
        MATRUNDAN_WORK_CHROMIUM_ARGS: '["--no-sandbox"]',
      }),
    ).toEqual({ executablePath: "/cache/chromium", args: ["--no-sandbox"] });
  });

  test("accepts an empty argument list for an externally prepared browser", () => {
    expect(
      workChromiumLaunchOptions({
        MATRUNDAN_WORK_CHROMIUM_EXECUTABLE_PATH: "/cache/chromium",
      }),
    ).toEqual({ executablePath: "/cache/chromium", args: [] });
  });

  test("rejects malformed browser arguments", () => {
    expect(() =>
      workChromiumLaunchOptions({
        MATRUNDAN_WORK_CHROMIUM_EXECUTABLE_PATH: "/cache/chromium",
        MATRUNDAN_WORK_CHROMIUM_ARGS: '{"unexpected":true}',
      }),
    ).toThrow("JSON-array av strängar");
  });
});
