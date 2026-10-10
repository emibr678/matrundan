import { expect, test } from "bun:test";
import { expandedNameRadiusKm } from "./place-search-expansion";

test("one bounded name expansion without silently changing the search radius", () => {
  expect(expandedNameRadiusKm(1)).toBe(2);
  expect(expandedNameRadiusKm(2)).toBe(4);
  expect(expandedNameRadiusKm(5)).toBe(7);
  expect(expandedNameRadiusKm(10)).toBe(12);
  expect(expandedNameRadiusKm(25)).toBe(27);
  expect(expandedNameRadiusKm(50)).toBeNull();
  expect(expandedNameRadiusKm(null)).toBeNull();
});
