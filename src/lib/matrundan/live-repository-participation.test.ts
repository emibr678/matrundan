import { describe, expect, test } from "bun:test";

import { resolveOwnVisitParticipationStatus } from "./live-repository";

describe("live-repository deltagarstatus", () => {
  test("respekterar serverns kanoniska participant även om participantIds är minimerad", () => {
    expect(resolveOwnVisitParticipationStatus("participant", [], "me")).toBe("participant");
  });

  test("respekterar declined även om participantIds råkar innehålla användaren", () => {
    expect(resolveOwnVisitParticipationStatus("declined", ["me"], "me")).toBe("declined");
  });

  test("använder participantIds endast som fallback för äldre payload utan status", () => {
    expect(resolveOwnVisitParticipationStatus(undefined, ["me"], "me")).toBe("participant");
    expect(resolveOwnVisitParticipationStatus(undefined, ["other"], "me")).toBe("none");
  });
});
