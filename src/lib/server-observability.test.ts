import { describe, expect, test } from "bun:test";

import { REQUEST_ID_HEADER, responseWithRequestId } from "./server-observability";

const OUTER_REQUEST_ID = "3d594650-3436-4b16-9e56-b3d6413f03d9";
const INNER_ERROR_ID = "8d80bbb6-3b57-4b12-a060-369b275e6640";

describe("server-observability request-kontrakt", () => {
  test("lägger korrelations-id på svar utan att modifiera inkommande Request", () => {
    const request = new Request("https://staging.matrundan.workers.dev/grupp");
    const response = responseWithRequestId(new Response("ok"), OUTER_REQUEST_ID);

    expect(request.headers.get(REQUEST_ID_HEADER)).toBeNull();
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(OUTER_REQUEST_ID);
  });

  test("bevarar ett giltigt fel-id från ett inre serverlager", () => {
    const response = new Response("fel", {
      status: 500,
      headers: { [REQUEST_ID_HEADER]: INNER_ERROR_ID },
    });

    const observed = responseWithRequestId(response, OUTER_REQUEST_ID);

    expect(observed.headers.get(REQUEST_ID_HEADER)).toBe(INNER_ERROR_ID);
  });

  test("ersätter ett ogiltigt korrelations-id", () => {
    const response = new Response("ok", {
      headers: { [REQUEST_ID_HEADER]: "inte-ett-request-id" },
    });

    const observed = responseWithRequestId(response, OUTER_REQUEST_ID);

    expect(observed.headers.get(REQUEST_ID_HEADER)).toBe(OUTER_REQUEST_ID);
  });
});
