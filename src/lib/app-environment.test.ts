import { describe, expect, test } from "bun:test";
import { appPageTitle, formatDeploymentTime, normalizeAppEnvironment } from "./app-environment";

describe("appmiljö", () => {
  test("normaliserar endast kända miljöetiketter", () => {
    expect(normalizeAppEnvironment(" staging ")).toBe("staging");
    expect(normalizeAppEnvironment("PROD")).toBe("prod");
    expect(normalizeAppEnvironment("local")).toBe("local");
    expect(normalizeAppEnvironment("preview")).toBe("unknown");
    expect(normalizeAppEnvironment(undefined)).toBe("unknown");
  });

  test("behåller produktionsnamnet när staging inte är byggmiljö", () => {
    expect(appPageTitle("Hem")).toBe("Hem · Matrundan");
  });

  test("formaterar driftsättningstid uttryckligen i svensk tidszon", () => {
    const formatted = formatDeploymentTime("2026-09-13T19:56:00Z");
    expect(formatted).toContain("13 sep. 2026");
    expect(formatted).toContain("21:56");
    expect(formatted).toMatch(/CEST|GMT\+2/);
    expect(formatDeploymentTime(null)).toBe("Ej angiven");
  });
});
