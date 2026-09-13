import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const rating = readFileSync(resolve(root, "src/components/matrundan/Rating.tsx"), "utf8");

describe("Issue #307 — decimalstjärnor", () => {
  test("stjärnfyllnaden följer decimalvärdet och avrundas inte till heltal", () => {
    expect(rating).toContain("value - i");
    expect(rating).toContain("fill * 100");
    expect(rating).not.toContain("Math.round(value)");
  });
});
