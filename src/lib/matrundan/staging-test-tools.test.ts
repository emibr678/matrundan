import { describe, expect, test } from "bun:test";
import { canUseStagingTestTools } from "./staging-test-tools";

describe("staging test tools", () => {
  test("är bara tillgängligt för inloggat live-läge i staging", () => {
    expect(
      canUseStagingTestTools({
        environment: "staging",
        signedIn: true,
        liveMode: true,
      }),
    ).toBe(true);

    for (const environment of ["local", "prod", "unknown"] as const) {
      expect(
        canUseStagingTestTools({
          environment,
          signedIn: true,
          liveMode: true,
        }),
      ).toBe(false);
    }

    expect(
      canUseStagingTestTools({
        environment: "staging",
        signedIn: false,
        liveMode: true,
      }),
    ).toBe(false);
    expect(
      canUseStagingTestTools({
        environment: "staging",
        signedIn: true,
        liveMode: false,
      }),
    ).toBe(false);
  });
});
