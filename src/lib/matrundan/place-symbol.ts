import { findFoodTags } from "./food-tags";
import type { PlaceCategory } from "./types";

const CATEGORY_SYMBOL: Record<PlaceCategory, string> = {
  restaurang: "🍽️",
  café: "☕",
  bageri: "🥐",
  snabbmat: "🍔",
  pub: "🍺",
  matvagn: "🌭",
};

type SymbolRule = {
  symbol: string;
  family: string;
};

const SPECIALTY_SYMBOLS: Record<string, SymbolRule> = {
  "specialty:sushi": { symbol: "🍣", family: "sushi" },
  "specialty:ramen": { symbol: "🍜", family: "ramen" },
  "specialty:pizza": { symbol: "🍕", family: "pizza" },
  "specialty:burger": { symbol: "🍔", family: "burger" },
  "specialty:grill": { symbol: "🔥", family: "grill" },
  "specialty:tapas": { symbol: "🫒", family: "tapas" },
  "specialty:seafood": { symbol: "🐟", family: "seafood" },
  "specialty:bowl": { symbol: "🥗", family: "bowl" },
  "specialty:pasta": { symbol: "🍝", family: "pasta" },
  "specialty:falafel": { symbol: "🧆", family: "falafel" },
  "specialty:street-food": { symbol: "🌯", family: "street-food" },
  "specialty:home-style": { symbol: "🍲", family: "home-style" },
  "specialty:small-plates": { symbol: "🍢", family: "small-plates" },
  "specialty:fika": { symbol: "☕", family: "coffee" },
  "specialty:coffee": { symbol: "☕", family: "coffee" },
  "specialty:pastries": { symbol: "🥐", family: "pastry" },
  "specialty:sourdough": { symbol: "🍞", family: "sourdough" },
  "specialty:danish-pastry": { symbol: "🥐", family: "pastry" },
};

const CUISINE_SYMBOLS: Record<string, SymbolRule> = {
  "cuisine:italian": { symbol: "🍝", family: "italian" },
  "cuisine:japanese": { symbol: "🍱", family: "japanese" },
  "cuisine:chinese": { symbol: "🥟", family: "chinese" },
  "cuisine:thai": { symbol: "🍛", family: "thai" },
  "cuisine:vietnamese": { symbol: "🍜", family: "vietnamese" },
  "cuisine:indian": { symbol: "🍛", family: "indian" },
  "cuisine:middle-eastern": { symbol: "🧆", family: "middle-eastern" },
  "cuisine:mexican-latin": { symbol: "🌮", family: "mexican-latin" },
  "cuisine:mediterranean": { symbol: "🫒", family: "mediterranean" },
  "cuisine:greek": { symbol: "🫒", family: "greek" },
  "cuisine:french": { symbol: "🥖", family: "french" },
  "cuisine:spanish": { symbol: "🥘", family: "spanish" },
  "cuisine:american": { symbol: "🍔", family: "american" },
  "cuisine:persian": { symbol: "🍚", family: "persian" },
  "cuisine:vegetarian-vegan": { symbol: "🌿", family: "vegetarian-vegan" },
};

const GENERATED_CATEGORY_SYMBOLS = new Set(Object.values(CATEGORY_SYMBOL));

export type PlaceSymbolSource = {
  category: PlaceCategory;
  cuisines?: readonly string[] | null;
  photo?: string | null;
};

export function emojiForCategory(category: PlaceCategory): string {
  return CATEGORY_SYMBOL[category];
}

export function isExplicitPlaceSymbol(symbol: string | null | undefined): boolean {
  const trimmed = symbol?.trim();
  return Boolean(trimmed && !GENERATED_CATEGORY_SYMBOLS.has(trimmed));
}

function resolveMetadataSymbol(
  values: readonly string[],
  group: "specialty" | "cuisine",
  rules: Record<string, SymbolRule>,
): string | undefined {
  const matches = new Map<string, string>();

  for (const value of values) {
    for (const tag of findFoodTags(value)) {
      if (tag.group !== group) continue;
      const rule = rules[tag.id];
      if (!rule) continue;
      matches.set(rule.family, rule.symbol);
    }
  }

  if (matches.size !== 1) return undefined;
  return matches.values().next().value;
}

export function resolvePlaceSymbol(source: PlaceSymbolSource): string {
  const explicitSymbol = source.photo?.trim();
  if (isExplicitPlaceSymbol(explicitSymbol)) return explicitSymbol!;

  const cuisines = source.cuisines ?? [];
  const specialtySymbol = resolveMetadataSymbol(cuisines, "specialty", SPECIALTY_SYMBOLS);
  if (specialtySymbol) return specialtySymbol;

  const cuisineSymbol = resolveMetadataSymbol(cuisines, "cuisine", CUISINE_SYMBOLS);
  if (cuisineSymbol) return cuisineSymbol;

  return emojiForCategory(source.category);
}
