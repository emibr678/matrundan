import { describe, expect, test } from "bun:test";
import { FOOD_TAGS } from "./food-tags";
import {
  GEOAPIFY_DISCOVERY_CATEGORIES,
  geoapifyCategoriesForPlaceSearchIntent,
  hasStructuredGeoapifyMapping,
} from "./geoapify-place-search";
import { resolveDiscoverySearchIntent } from "./place-search-intent";
import { CATEGORY_LABEL, type PlaceCategory } from "./types";

/**
 * Issue #512: full, intentionally explicit 2026-10-22 search coverage baseline.
 *
 * A *direct Geoapify category* is NOT a claim of adequate real-world recall.
 * "Broad local fallback" below documents known weak behavior to be replaced
 * by the agreed retrieval/nearby-result strategy. These expectations must be
 * updated when the implementation changes — never silently drop a search term.
 */
const DIRECT_FOOD_TAG_CATEGORIES: Record<string, readonly string[]> = {
  "cuisine:swedish": ["catering.restaurant.swedish"],
  "cuisine:italian": ["catering.restaurant.italian"],
  "cuisine:japanese": ["catering.restaurant.japanese"],
  "cuisine:korean": ["catering.restaurant.korean"],
  "cuisine:chinese": ["catering.restaurant.chinese"],
  "cuisine:thai": ["catering.restaurant.thai"],
  "cuisine:vietnamese": ["catering.restaurant.vietnamese"],
  "cuisine:indian": ["catering.restaurant.indian"],
  "cuisine:mexican-latin": ["catering.restaurant.mexican", "catering.restaurant.latin_american"],
  "cuisine:mediterranean": ["catering.restaurant.mediterranean"],
  "cuisine:greek": ["catering.restaurant.greek"],
  "cuisine:french": ["catering.restaurant.french"],
  "cuisine:spanish": ["catering.restaurant.spanish"],
  "cuisine:american": ["catering.restaurant.american"],
  "cuisine:persian": ["catering.restaurant.persian"],
  "cuisine:international": ["catering.restaurant.international"],
  "specialty:sushi": ["catering.restaurant.sushi"],
  "specialty:ramen": ["catering.restaurant.ramen", "catering.fast_food.ramen"],
  "specialty:pizza": ["catering.restaurant.pizza", "catering.fast_food.pizza"],
  "specialty:burger": ["catering.restaurant.burger", "catering.fast_food.burger"],
  "specialty:grill": ["catering.restaurant.barbecue"],
  "specialty:tapas": ["catering.restaurant.tapas"],
  "specialty:seafood": ["catering.restaurant.seafood"],
  "specialty:coffee": ["catering.cafe.coffee"],
};

const CURRENT_BROAD_LOCAL_FALLBACK = [
  "cuisine:middle-eastern",
  "cuisine:vegetarian-vegan",
  "specialty:bowl",
  "specialty:pasta",
  "specialty:falafel",
  "specialty:street-food",
  "specialty:home-style",
  "specialty:small-plates",
  "specialty:pub-food",
  "specialty:fika",
  "specialty:pastries",
  "specialty:sourdough",
  "specialty:danish-pastry",
] as const;

const DIRECT_PLACE_TYPES: Partial<Record<PlaceCategory, readonly string[]>> = {
  restaurang: ["catering.restaurant"],
  "café": ["catering.cafe"],
  bageri: ["commercial.food_and_drink.bakery"],
  snabbmat: ["catering.fast_food"],
  pub: ["catering.pub"],
};
const FALLBACK_PLACE_TYPES: readonly PlaceCategory[] = ["matvagn"];

describe("Issue #512 — sökkatalogens fullständiga utgångsläge", () => {
  test("alla 37 befintliga kök/inriktningar är uttryckligen inventerade", () => {
    const ids = FOOD_TAGS.map((tag) => tag.id);
    const covered = [
      ...Object.keys(DIRECT_FOOD_TAG_CATEGORIES),
      ...CURRENT_BROAD_LOCAL_FALLBACK,
    ];
    expect(new Set(ids).size).toBe(37);
    expect(new Set(covered).size).toBe(37);
    expect(ids.toSorted()).toEqual(covered.toSorted());
  });

  test("alla sex typer ingår och ingen typ lämnas implicit", () => {
    const types = Object.keys(CATEGORY_LABEL) as PlaceCategory[];
    const covered = [...Object.keys(DIRECT_PLACE_TYPES), ...FALLBACK_PLACE_TYPES];
    expect(types).toHaveLength(6);
    expect(types.toSorted()).toEqual(covered.toSorted());
  });

  test("24 direktmappade begrepp använder dokumenterade kategorier, inte en fri namnsökning", () => {
    expect(Object.keys(DIRECT_FOOD_TAG_CATEGORIES)).toHaveLength(24);
    for (const tag of FOOD_TAGS.filter((tag) => tag.id in DIRECT_FOOD_TAG_CATEGORIES)) {
      const intent = resolveDiscoverySearchIntent(tag.label, "auto", {
        kind: "food-tag",
        id: tag.id,
      });
      expect(intent.kind).toBe("food-tag");
      expect(hasStructuredGeoapifyMapping(intent)).toBe(true);
      expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(
        DIRECT_FOOD_TAG_CATEGORIES[tag.id],
      );
    }
  });

  test("13 omappade begrepp identifieras som svag, icke-uttömmande fallback", () => {
    expect(CURRENT_BROAD_LOCAL_FALLBACK).toHaveLength(13);
    for (const id of CURRENT_BROAD_LOCAL_FALLBACK) {
      const tag = FOOD_TAGS.find((entry) => entry.id === id);
      expect(tag).toBeDefined();
      const intent = resolveDiscoverySearchIntent(tag!.label, "auto", {
        kind: "food-tag",
        id,
      });
      expect(hasStructuredGeoapifyMapping(intent)).toBe(false);
      expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(
        GEOAPIFY_DISCOVERY_CATEGORIES,
      );
    }
  });

  test("alla sex typval har den kartlagda dagens providervägen", () => {
    for (const category of Object.keys(CATEGORY_LABEL) as PlaceCategory[]) {
      const intent = resolveDiscoverySearchIntent(CATEGORY_LABEL[category], "auto", {
        kind: "category",
        id: `category:${category}`,
      });
      expect(intent.kind).toBe("category");
      const expected = DIRECT_PLACE_TYPES[category];
      expect(hasStructuredGeoapifyMapping(intent)).toBe(Boolean(expected));
      expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(
        expected ?? GEOAPIFY_DISCOVERY_CATEGORIES,
      );
    }
  });

  test("kök/inriktning väljs uttryckligen; samma skrivna ord kan vara ett matställesnamn", () => {
    for (const word of ["Pizza", "Sushi", "Pasta", "Husmanskost", "Fika"]) {
      expect(resolveDiscoverySearchIntent(word, "literal").kind).toBe("text");
    }
  });
});
