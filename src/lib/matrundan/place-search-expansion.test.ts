import { expect, test } from "bun:test";
import { expandedNameRadiusKm, nameRecoveryProbeRadiusKm } from "./place-search-expansion";

test("one bounded name expansion without silently changing the search radius", () => {
  expect(expandedNameRadiusKm(1)).toBe(2);
  expect(expandedNameRadiusKm(2)).toBe(4);
  expect(expandedNameRadiusKm(5)).toBe(7);
  expect(expandedNameRadiusKm(10)).toBe(12);
  expect(expandedNameRadiusKm(25)).toBe(27);
  expect(expandedNameRadiusKm(50)).toBeNull();
  expect(expandedNameRadiusKm(null)).toBeNull();
});

test("provider-only name probe may look further but never changes the accepted nearby radius", () => {
  expect(expandedNameRadiusKm(1)).toBe(2);
  expect(nameRecoveryProbeRadiusKm(1)).toBe(4);
  expect(expandedNameRadiusKm(2)).toBe(4);
  expect(nameRecoveryProbeRadiusKm(2)).toBe(6);
  expect(nameRecoveryProbeRadiusKm(50)).toBeNull();
  expect(nameRecoveryProbeRadiusKm(null)).toBeNull();
});
