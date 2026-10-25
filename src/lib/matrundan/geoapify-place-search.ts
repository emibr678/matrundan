import { relatedSearchConcepts, searchConceptById } from "./search-catalogue";
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

export const SEARCH_PROVIDER_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  "category:restaurang": ["catering.restaurant"],
  "category:café": ["catering.cafe"],
  "category:bageri": ["commercial.food_and_drink.bakery"],
  "category:snabbmat": ["catering.fast_food"],
  "category:pub": ["catering.pub", "catering.bar", "catering.biergarten", "catering.taproom"],
  "search:swedish": ["catering.restaurant.swedish"],
  "cuisine:italian": ["catering.restaurant.italian"],
  "cuisine:japanese": ["catering.restaurant.japanese"],
  "cuisine:korean": ["catering.restaurant.korean"],
  "cuisine:chinese": ["catering.restaurant.chinese"],
  "cuisine:thai": ["catering.restaurant.thai"],
  "cuisine:vietnamese": ["catering.restaurant.vietnamese"],
  "cuisine:indian": ["catering.restaurant.indian"],
  "cuisine:middle-eastern": [
    "catering.restaurant.arab",
    "catering.restaurant.lebanese",
    "catering.restaurant.syrian",
    "catering.restaurant.turkish",
    "catering.restaurant.persian",
  ],
  "search:libanesiskt": ["catering.restaurant.lebanese"],
  "search:mexican": ["catering.restaurant.mexican"],
  "cuisine:mediterranean": ["catering.restaurant.mediterranean"],
  "cuisine:greek": ["catering.restaurant.greek"],
  "cuisine:french": ["catering.restaurant.french"],
  "cuisine:spanish": ["catering.restaurant.spanish"],
  "cuisine:american": ["catering.restaurant.american"],
  "cuisine:persian": ["catering.restaurant.persian"],
  "search:asiatiskt": [
    "catering.restaurant.asian",
    "catering.restaurant.chinese",
    "catering.restaurant.japanese",
    "catering.restaurant.korean",
    "catering.restaurant.thai",
    "catering.restaurant.vietnamese",
    "catering.restaurant.taiwanese",
    "catering.restaurant.indonesian",
    "catering.restaurant.malaysian",
    "catering.restaurant.malay",
    "catering.restaurant.filipino",
  ],
  "specialty:pizza": ["catering.restaurant.pizza", "catering.fast_food.pizza"],
  "specialty:burger": ["catering.restaurant.burger", "catering.fast_food.burger"],
  "specialty:sushi": ["catering.restaurant.sushi"],
  "specialty:ramen": ["catering.restaurant.ramen", "catering.fast_food.ramen"],
  "specialty:pasta": [],
  "search:kebab": ["catering.restaurant.kebab", "catering.fast_food.kebab"],
  "specialty:falafel": [],
  "search:sallad": ["catering.fast_food.salad"],
  "search:smorgasar": ["catering.restaurant.sandwich", "catering.fast_food.sandwich"],
  "specialty:grill": ["catering.restaurant.barbecue"],
  "specialty:seafood": ["catering.restaurant.seafood", "catering.restaurant.fish"],
  "specialty:tapas": ["catering.restaurant.tapas", "catering.fast_food.tapas"],
  "specialty:fika": ["catering.cafe", "commercial.food_and_drink.bakery"],
  "search:vegetarian-only": [],
  "search:vegan-only": [],
  "search:turkiskt": ["catering.restaurant.turkish"],
  "search:etiopiskt": ["catering.restaurant.ethiopian"],
  "search:afrikanskt": ["catering.restaurant.african"],
  "search:tyskt": ["catering.restaurant.german"],
  "search:danskt": ["catering.restaurant.danish"],
  "search:portugisiskt": ["catering.restaurant.portuguese"],
  "search:brasilianskt": ["catering.restaurant.brazilian"],
  "search:peruanskt": ["catering.restaurant.peruvian"],
  "search:argentinskt": ["catering.restaurant.argentinian"],
  "search:karibiskt": ["catering.restaurant.caribbean"],
  "search:pakistanskt": ["catering.restaurant.pakistani"],
  "search:afghanskt": ["catering.restaurant.afghan"],
  "search:indonesiskt": ["catering.restaurant.indonesian"],
  "search:malaysiskt": ["catering.restaurant.malaysian"],
  "search:filippinskt": ["catering.restaurant.filipino"],
  "search:osterrikiskt": ["catering.restaurant.austrian"],
  "search:ryskt": ["catering.restaurant.russian"],
  "search:latinamerikanskt": ["catering.restaurant.latin_american"],
  "search:europeiskt": ["catering.restaurant.european"],
  "cuisine:international": ["catering.restaurant.international"],
  "search:steakhouse": ["catering.restaurant.steak_house"],
  "search:mathall-food-court": ["catering.food_court"],
  "search:deli": ["commercial.food_and_drink.deli"],
  "search:wings": ["catering.restaurant.wings", "catering.fast_food.wings"],
  "search:nudlar": ["catering.restaurant.noodle", "catering.fast_food.noodle"],
  "search:dumplings": ["catering.restaurant.dumpling"],
  "search:tacos": ["catering.restaurant.tacos", "catering.fast_food.tacos"],
  "search:texmex": ["catering.restaurant.tex-mex"],
  "search:soppa": ["catering.restaurant.soup", "catering.fast_food.soup"],
  "search:fish-and-chips": [
    "catering.restaurant.fish_and_chips",
    "catering.fast_food.fish_and_chips",
  ],
  "search:korv": ["catering.fast_food.hot_dog"],
  "specialty:coffee": ["catering.cafe.coffee", "catering.cafe.coffee_shop"],
  "search:te": ["catering.cafe.tea"],
  "search:dessert": ["catering.cafe.dessert"],
  "search:tarta": ["catering.cafe.cake"],
  "search:vafflor": ["catering.cafe.waffle"],
  "search:crêpes": ["catering.cafe.crepe"],
  "search:donuts": ["catering.cafe.donut"],
  "search:frozen-yoghurt": ["catering.cafe.frozen_yogurt"],
  "search:bubble-tea": ["catering.cafe.bubble_tea"],
  "search:kyckling": ["catering.restaurant.chicken"],
  "search:glassbar": ["catering.ice_cream", "catering.cafe.ice_cream"],
  "category:matvagn": [],
};

export function geoapifyCategoriesForPlaceSearchIntent(
  intent: PlaceSearchIntent,
): readonly string[] {
  if (intent.kind === "category") {
    const current = SEARCH_PROVIDER_CATEGORIES[`category:${intent.category}`];
    if (current?.length) return current;
    return CATEGORY_PROVIDER_CATEGORIES[intent.category] ?? GEOAPIFY_DISCOVERY_CATEGORIES;
  }
  if (intent.kind === "food-tag") {
    return SEARCH_PROVIDER_CATEGORIES[intent.tagId]?.length
      ? SEARCH_PROVIDER_CATEGORIES[intent.tagId]
      : (FOOD_TAG_PROVIDER_CATEGORIES[intent.tagId] ?? GEOAPIFY_DISCOVERY_CATEGORIES);
  }
  return GEOAPIFY_DISCOVERY_CATEGORIES;
}

export function hasStructuredGeoapifyMapping(intent: PlaceSearchIntent): boolean {
  if (intent.kind === "category") return Boolean(CATEGORY_PROVIDER_CATEGORIES[intent.category]);
  if (intent.kind === "food-tag")
    return Boolean(
      SEARCH_PROVIDER_CATEGORIES[intent.tagId]?.length ||
      FOOD_TAG_PROVIDER_CATEGORIES[intent.tagId],
    );
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

/** One shared raw-metadata stream, independent of a direct/union stream. */
export function geoapifySearchRecipe(intent: PlaceSearchIntent) {
  const id =
    intent.kind === "food-tag"
      ? intent.tagId
      : intent.kind === "category"
        ? `category:${intent.category}`
        : "";
  const concept = searchConceptById(id);
  const direct =
    SEARCH_PROVIDER_CATEGORIES[id] ??
    (hasStructuredGeoapifyMapping(intent) ? geoapifyCategoriesForPlaceSearchIntent(intent) : []);
  // Never query the invalid catering.food_truck category. Known canonical rows can still match.
  if (id === "category:matvagn")
    return {
      id,
      direct: [] as readonly string[],
      related: [] as readonly string[],
      supplement: [] as readonly (readonly string[])[],
      conditions: [] as string[],
    };
  const profile = concept?.profile;
  const supplement =
    concept?.kind === "food-tag" && !profile && id !== "specialty:fika"
      ? concept.group === "cuisine" ||
        ![
          "specialty:coffee",
          "search:te",
          "search:dessert",
          "search:tarta",
          "search:vafflor",
          "search:crêpes",
          "search:donuts",
          "search:frozen-yoghurt",
          "search:bubble-tea",
          "search:glassbar",
        ].includes(id)
        ? [
            ["catering.fast_food"],
            ["catering.restaurant"],
            GEOAPIFY_DISCOVERY_CATEGORIES.filter(
              (c) => c !== "catering.fast_food" && c !== "catering.restaurant",
            ),
          ]
        : [
            GEOAPIFY_DISCOVERY_CATEGORIES.filter(
              (c) => c !== "catering.fast_food" && c !== "catering.restaurant",
            ),
            ["catering.restaurant"],
            ["catering.fast_food"],
          ]
      : [];
  // The observed Pasta gap is in restaurant metadata; Falafel and misplaced
  // Sushi/Thai prioritise fast_food. This is one source-order setting, not a dish detector.
  if (id === "specialty:pasta") [supplement[0], supplement[1]] = [supplement[1], supplement[0]];
  return {
    id,
    direct: profile ? GEOAPIFY_DISCOVERY_CATEGORIES : direct,
    related: [
      ...new Set(
        relatedSearchConcepts(id).flatMap((target) => SEARCH_PROVIDER_CATEGORIES[target.id] ?? []),
      ),
    ].sort(),
    supplement,
    conditions: profile ? [`${profile}.only`] : [],
  };
}
