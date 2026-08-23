import { describe, expect, test } from "bun:test";

import { isRequestId, safeErrorCode, sanitizeOperation } from "./observability";

describe("observability-kontrakt", () => {
  test("ersätter inbjudningstoken och tar bort query", () => {
    expect(
      sanitizeOperation(
        "https://staging.matrundan.workers.dev/inbjudan/super-hemlig-token-1234567890?next=/grupp",
      ),
    ).toBe("/inbjudan/:token");
  });

  test("ersätter UUID, numeriska och långa opaka pathsegment", () => {
    expect(
      sanitizeOperation(
        "/grupp/550e8400-e29b-41d4-a716-446655440000/besok/123/foto/abcdefghijklmnopqrstuvwx",
      ),
    ).toBe("/grupp/:id/besok/:id/foto/:id");
  });

  test("bevarar säkra route-segment utan query eller fragment", () => {
    expect(sanitizeOperation("/matställen/sök?lat=59.1&lng=18.2#karta")).toBe(
      "/matställen/sök",
    );
  });

  test("använder stabil felkod utan att logga felmeddelandet", () => {
    expect(safeErrorCode(new Error("GEOAPIFY_TIMEOUT: privat detalj"))).toBe(
      "GEOAPIFY_TIMEOUT",
    );
    expect(safeErrorCode(new TypeError("hemligt värde"))).toBe("JS_TYPEERROR");
  });

  test("validerar endast ofarliga UUIDv4-request-id", () => {
    expect(isRequestId("3d594650-3436-4b16-9e56-b3d6413f03d9")).toBe(true);
    expect(isRequestId("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
    expect(isRequestId("user-123")).toBe(false);
  });
});
