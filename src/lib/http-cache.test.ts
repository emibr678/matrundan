import { describe, expect, test } from "bun:test";
import { withPrivateDocumentCachePolicy } from "./http-cache";

describe("withPrivateDocumentCachePolicy", () => {
  test("marks rendered HTML as no-store while preserving response metadata", async () => {
    const response = new Response("<html></html>", {
      status: 201,
      statusText: "Created",
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-existing": "kept",
      },
    });

    const result = withPrivateDocumentCachePolicy(response);

    expect(result.status).toBe(201);
    expect(result.statusText).toBe("Created");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("x-existing")).toBe("kept");
    expect(await result.text()).toBe("<html></html>");
  });

  test("leaves non-HTML responses unchanged", () => {
    const response = new Response("{}", {
      headers: { "content-type": "application/json" },
    });

    expect(withPrivateDocumentCachePolicy(response)).toBe(response);
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
