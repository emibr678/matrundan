import { expect, test } from "bun:test";
import {
  hasSingleNameTypo,
  matchesTypoPlaceName,
  preciseProviderRecoverySeed,
  typoProviderSearchSeed,
} from "./place-search-typo";

test("single character mistakes and swapped neighbors", () => {
  expect(hasSingleNameTypo("pharmarim", "pharmarium")).toBe(true);
  expect(hasSingleNameTypo("phamarium", "pharmarium")).toBe(true);
  expect(hasSingleNameTypo("phramarium", "pharmarium")).toBe(true);
  expect(hasSingleNameTypo("wrong", "pharmarium")).toBe(false);
});

test("specific name retrieval tolerates one typo, not generic or double mistakes", () => {
  expect(matchesTypoPlaceName("Pharmarim", "Pharmarium")).toBe(true);
  expect(matchesTypoPlaceName("Efraim bark", "Efraim Barbits Pub")).toBe(true);
  expect(matchesTypoPlaceName("Efraim bark", "Efraim Park")).toBe(true);
  expect(matchesTypoPlaceName("Efrim bark", "Efraim Barbits Pub")).toBe(false);
  expect(matchesTypoPlaceName("bar", "Barbits Pub")).toBe(false);
  expect(matchesTypoPlaceName("restaurang", "Restaurangen")).toBe(false);
});

test("typo provider recovery uses a narrow anchor, not a category browse", () => {
  expect(typoProviderSearchSeed("Efraim bark")).toBe("efraim");
  expect(typoProviderSearchSeed("Pharmarim")).toBe("pharma");
  expect(typoProviderSearchSeed("bar")).toBeNull();
  expect(typoProviderSearchSeed("restaurang")).toBeNull();
});

test("precise provider probe fixes one trailing double-letter typo without changing identity rules", () => {
  expect(preciseProviderRecoverySeed("Pelikann")).toBe("pelikan");
  expect(preciseProviderRecoverySeed("Falloumi")).toBe("falloumi");
  expect(preciseProviderRecoverySeed("Pharmarim")).toBe("pharmarim");
  expect(preciseProviderRecoverySeed("Efraim bark")).toBeNull();
  expect(preciseProviderRecoverySeed("restaurang")).toBeNull();
  expect(preciseProviderRecoverySeed("Ox")).toBeNull();
  expect(matchesTypoPlaceName("Pelikann", "Pelikan")).toBe(true);
  expect(matchesTypoPlaceName("Pelikann", "Pelikan pub")).toBe(true);
  expect(matchesTypoPlaceName("Pelikann", "Pelle")).toBe(false);
});
