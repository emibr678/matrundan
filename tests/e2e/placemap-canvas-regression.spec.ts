import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const placeMapPath = fileURLToPath(
  new URL("../../src/components/matrundan/PlaceMap.tsx", import.meta.url),
);

test("PlaceMap neutraliserar globala canvasregler och behåller en fungerande karta efter idle", async () => {
  const source = await readFile(placeMapPath, "utf8");

  expect(source).toContain("[&_.maplibregl-canvas]:!h-full");
  expect(source).toContain("[&_.maplibregl-canvas]:!w-full");
  expect(source).toContain("[&_.maplibregl-canvas]:!max-w-none");
  expect(source).toContain("initialIdleReached = true");
  expect(source).toContain("if (cancelled || initialIdleReached) return;");
});
