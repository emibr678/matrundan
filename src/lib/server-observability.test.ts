import { describe, expect, test } from "bun:test";

import { REQUEST_ID_HEADER, requestWithObservabilityHeaders } from "./server-observability";

describe("server-observability request-kontrakt", () => {
  test("lägger korrelationsheader på en ny Request utan att mutera originalet", () => {
    const request = new Request("https://staging.matrundan.workers.dev/grupp", {
      headers: { "x-existing": "bevaras" },
    });
    const requestId = "3d594650-3436-4b16-9e56-b3d6413f03d9";

    const observed = requestWithObservabilityHeaders(request, requestId);

    expect(observed).not.toBe(request);
    expect(request.headers.get(REQUEST_ID_HEADER)).toBeNull();
    expect(observed.headers.get(REQUEST_ID_HEADER)).toBe(requestId);
    expect(observed.headers.get("x-existing")).toBe("bevaras");
    expect(observed.url).toBe(request.url);
    expect(observed.method).toBe(request.method);
  });

  test("kräver inte Request.clone för att lägga till korrelationsheader", () => {
    const request = new Request("https://staging.matrundan.workers.dev/");
    Object.defineProperty(request, "clone", {
      configurable: true,
      value: () => {
        throw new Error("Request.clone ska inte användas när headers behöver ändras");
      },
    });

    const observed = requestWithObservabilityHeaders(
      request,
      "3d594650-3436-4b16-9e56-b3d6413f03d9",
    );

    expect(observed.headers.get(REQUEST_ID_HEADER)).toBe("3d594650-3436-4b16-9e56-b3d6413f03d9");
  });
});
