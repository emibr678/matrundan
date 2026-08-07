import type { PlaceSearchIntent } from "./place-search-intent";
import type { PlaceCategory } from "./types";

export const GEOAPIFY_DISCOVERY_CATEGORIES = [
  "catering.restaurant",
  "catering.fast_food",
  "catering.food_court",
  "catering.cafe",
  "catering.pub",
  "catering.bar",
  "catering.biergarten",
  "catering.taproom",
  "catering.ice_cream",
  "commercial.food_and_drink.bakery",
] as const;

const CATEGORY_PROVIDER_CATEGORIES: Partial<Record<PlaceCategory, readonly string[]>> = {
  restaurang: ["catering.restaurant"],
  café: ["catering.cafe"],
  bageri: ["commercial.food_and_drink.bakery"],
  snabbmat: ["catering.fast_food"],
  pub: ["catering.pub"],
};

const FOOD_TAG_PROVIDER_CATEGORIES: Record<string, readonly string[]> = {
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

export function geoapifyCategoriesForPlaceSearchIntent(
  intent: PlaceSearchIntent,
): readonly string[] {
  if (intent.kind === "category") {
    return CATEGORY_PROVIDER_CATEGORIES[intent.category] ?? GEOAPIFY_DISCOVERY_CATEGORIES;
  }
  if (intent.kind === "food-tag") {
    return FOOD_TAG_PROVIDER_CATEGORIES[intent.tagId] ?? GEOAPIFY_DISCOVERY_CATEGORIES;
  }
  return GEOAPIFY_DISCOVERY_CATEGORIES;
}

export function hasStructuredGeoapifyMapping(intent: PlaceSearchIntent): boolean {
  if (intent.kind === "category") return Boolean(CATEGORY_PROVIDER_CATEGORIES[intent.category]);
  if (intent.kind === "food-tag") return Boolean(FOOD_TAG_PROVIDER_CATEGORIES[intent.tagId]);
  return false;
}

export function geoapifyNameQueryForPlaceSearchIntent(
  intent: PlaceSearchIntent,
): string | undefined {
  if (intent.kind !== "text") return undefined;
  const value = intent.query.trim();
  if (!value || value.length < 3 || value.length > 80) return undefined;
  return value;
}
