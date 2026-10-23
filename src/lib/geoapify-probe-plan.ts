// TEMPORARY RESEARCH ONLY — broad, comparable real Geoapify measurements.
// Never merge this branch. No network calls until an authenticated operator starts.
// Every existing searchable cuisine, specialty and place type is represented;
// identical provider queries within an area are shared rather than billed repeatedly.
import { FOOD_TAGS } from "./matrundan/food-tags";
import {
  GEOAPIFY_DISCOVERY_CATEGORIES,
  geoapifyCategoriesForPlaceSearchIntent,
} from "./matrundan/geoapify-place-search";
import { resolvePlaceSearchIntent } from "./matrundan/place-search-intent";

export const STUDY_ID = "geoapify-wide-2026-10-23-v1";
export const PROBE_LIMIT = 100;
export const PROBE_MAX_NEW_CALLS = 440;
export const PROBE_MAX_NEW_RESERVED_CREDITS = 2200;

const originalAreas = [
  { id: "sodermalm", label: "Södermalm", lat: 59.3143, lon: 18.0732 },
  { id: "enskede", label: "Enskede", lat: 59.284, lon: 18.087 },
  { id: "goteborg", label: "Göteborg – Järntorget", lat: 57.6998, lon: 11.9523 },
  { id: "malmo", label: "Malmö – Triangeln", lat: 55.5955, lon: 13.0014 },
  { id: "uppsala", label: "Uppsala – Stora torget", lat: 59.8581, lon: 17.6386 },
  { id: "varnamo", label: "Värnamo", lat: 57.186, lon: 14.041 },
] as const;

type Area = { id: string; label: string; lat: number; lon: number; radius: number };
export type ProbeJob = {
  id: string;
  area: Area;
  strategy: string;
  categories: readonly string[];
  conditions: readonly string[];
  /** Human-facing filters or comparison questions covered by this actual API request. */
  covers: readonly string[];
  tier: "catalogue" | "comparison" | "radius";
  maxPages: number;
};

const baseAreas: Area[] = originalAreas.map((area) => ({
  ...area,
  radius: 2000,
  id: area.id + "-2km",
  label: area.label + " · 2 km",
}));
const radiusAreas: Area[] = [
  { ...originalAreas[1], id: "enskede-10km", label: "Enskede · 10 km", radius: 10000 },
  { ...originalAreas[5], id: "varnamo-10km", label: "Värnamo · 10 km", radius: 10000 },
  { ...originalAreas[0], id: "sodermalm-25km", label: "Södermalm · 25 km", radius: 25000 },
];

type Recipe = {
  strategy: string;
  categories: readonly string[];
  conditions?: readonly string[];
  covers: readonly string[];
  maxPages?: number;
};
const categoryNames = ["restaurang", "café", "bageri", "snabbmat", "pub", "matvagn"] as const;
const catalogueRecipes: Recipe[] = [
  ...FOOD_TAGS.map((tag) => ({
    strategy: tag.id,
    categories: geoapifyCategoriesForPlaceSearchIntent(resolvePlaceSearchIntent(tag.label)),
    covers: [tag.label],
    maxPages: 2,
  })),
  ...categoryNames.map((category) => ({
    strategy: "type:" + category,
    categories: geoapifyCategoriesForPlaceSearchIntent(resolvePlaceSearchIntent(category)),
    covers: [category],
    maxPages: 2,
  })),
];

const comparisonRecipes: Recipe[] = [
  { strategy: "baseline:restaurant", categories: ["catering.restaurant"], covers: ["Bred restaurangbaslinje"], maxPages: 5 },
  { strategy: "baseline:all-catering", categories: GEOAPIFY_DISCOVERY_CATEGORIES, covers: ["Bred matställebaslinje"], maxPages: 5 },
  { strategy: "alternative:asian", categories: ["catering.restaurant.asian"], covers: ["Asiatiskt direkt"] },
  { strategy: "alternative:asian-family", categories: [
    "catering.restaurant.asian", "catering.restaurant.chinese", "catering.restaurant.japanese",
    "catering.restaurant.korean", "catering.restaurant.thai", "catering.restaurant.vietnamese",
    "catering.restaurant.taiwanese", "catering.restaurant.indonesian",
    "catering.restaurant.malaysian", "catering.restaurant.malay", "catering.restaurant.filipino",
  ], covers: ["Asiatiskt paraply"] },
  { strategy: "alternative:middle-east", categories: [
    "catering.restaurant.arab", "catering.restaurant.lebanese", "catering.restaurant.syrian",
    "catering.restaurant.turkish", "catering.restaurant.persian",
  ], covers: ["Mellanöstern paraply"] },
  { strategy: "alternative:regional", categories: ["catering.restaurant.regional"], covers: ["Regionalt (inte automatiskt husmanskost)"] },
  { strategy: "alternative:kebab", categories: ["catering.restaurant.kebab", "catering.fast_food.kebab"], covers: ["Kebab"] },
  { strategy: "alternative:dumplings", categories: ["catering.restaurant.dumpling"], covers: ["Dumplings"] },
  { strategy: "alternative:vegetarian", categories: ["catering.restaurant", "catering.fast_food", "catering.cafe"], conditions: ["vegetarian"], covers: ["Vegetariskt villkor"], maxPages: 3 },
  { strategy: "alternative:vegan", categories: ["catering.restaurant", "catering.fast_food", "catering.cafe"], conditions: ["vegan"], covers: ["Veganskt villkor"], maxPages: 3 },
  { strategy: "alternative:cafe-bakery", categories: ["catering.cafe", "commercial.food_and_drink.bakery"], covers: ["Fika/Café + bageri"], maxPages: 3 },
  { strategy: "alternative:pizza-combined", categories: ["catering.restaurant.pizza", "catering.fast_food.pizza"], covers: ["Pizza kombinerat"] },
  { strategy: "alternative:ramen-combined", categories: ["catering.restaurant.ramen", "catering.fast_food.ramen"], covers: ["Ramen kombinerat"] },
  { strategy: "alternative:burger-combined", categories: ["catering.restaurant.burger", "catering.fast_food.burger"], covers: ["Burgare kombinerat"] },
  { strategy: "alternative:fast-food", categories: ["catering.fast_food"], covers: ["Gatukök/snabbmat"] },
  { strategy: "alternative:food-truck", categories: ["catering.food_truck"], covers: ["Matvagn / food truck"] },
];

const radiusSelection = new Set([
  "cuisine:swedish", "cuisine:italian", "cuisine:japanese", "cuisine:middle-eastern",
  "cuisine:vegetarian-vegan", "specialty:pizza", "specialty:burger", "specialty:sushi",
  "specialty:ramen", "specialty:grill", "specialty:pasta", "specialty:falafel",
  "specialty:fika", "specialty:home-style", "specialty:pub-food",
  "type:restaurang", "type:matvagn", "type:café",
]);
const radiusComparisons = new Set([
  "baseline:restaurant", "baseline:all-catering", "alternative:kebab", "alternative:dumplings",
  "alternative:asian-family", "alternative:middle-east", "alternative:regional",
  "alternative:cafe-bakery", "alternative:vegetarian", "alternative:vegan",
]);

function makeJobs(area: Area, recipes: readonly Recipe[], tier: ProbeJob["tier"]): ProbeJob[] {
  const rows = new Map<string, ProbeJob>();
  for (const recipe of recipes) {
    // Strictly share identical category+condition queries at the same geography.
    const categories = [...recipe.categories].sort();
    const conditions = [...(recipe.conditions ?? [])].sort();
    const signature = JSON.stringify([area.id, categories, conditions]);
    const existing = rows.get(signature);
    if (existing) {
      rows.set(signature, {
        ...existing,
        covers: [...new Set([...existing.covers, ...recipe.covers])],
        maxPages: Math.max(existing.maxPages, recipe.maxPages ?? 2),
      });
      continue;
    }
    rows.set(signature, {
      id: area.id + "/" + recipe.strategy,
      area,
      strategy: recipe.strategy,
      categories,
      conditions,
      covers: recipe.covers,
      tier,
      maxPages: recipe.maxPages ?? 2,
    });
  }
  return [...rows.values()];
}

// First, full catalogue + controls in each original 2 km area. Broader radii
// follow as a separate tier, so an interrupted run still covers the catalogue.
export const PROBE_JOBS: readonly ProbeJob[] = [
  ...baseAreas.flatMap((area) => makeJobs(area, [...catalogueRecipes, ...comparisonRecipes], "catalogue")),
  ...radiusAreas.flatMap((area) =>
    makeJobs(
      area,
      [
        ...catalogueRecipes.filter((recipe) => radiusSelection.has(recipe.strategy)),
        ...comparisonRecipes.filter((recipe) => radiusComparisons.has(recipe.strategy)),
      ],
      "radius",
    ),
  ),
];

export const STUDY_CATALOGUE_SIZE = FOOD_TAGS.length + categoryNames.length;
export const STUDY_LOCATIONS = baseAreas.length;
