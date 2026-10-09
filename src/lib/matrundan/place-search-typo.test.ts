import { expect, test } from "bun:test";
import { hasSingleNameTypo, matchesTypoPlaceName } from "./place-search-typo";

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
