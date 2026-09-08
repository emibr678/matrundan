import { describe, expect, test } from "bun:test";

const diagnosticsRouteSource = await Bun.file("src/routes/placemapdiagnostik.tsx").text();

describe("PlaceMap-diagnostikharness", () => {
  test("är explicit spärrad i production builds", () => {
    expect(diagnosticsRouteSource).toContain("if (import.meta.env.PROD) throw notFound();");
  });
});
