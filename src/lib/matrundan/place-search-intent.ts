import {
  FOOD_TAGS,
  findFoodTag,
  findFoodTags,
  foodTagSearchValue,
  type FoodTagDefinition,
} from "./food-tags";
import { CATEGORY_LABEL, type PlaceCategory } from "./types";

export type PlaceSearchIntent =
  | { kind: "browse"; query: "" }
  | {
      kind: "food-tag";
      query: string;
      tagId: string;
      label: string;
      group: FoodTagDefinition["group"];
    }
  | { kind: "category"; query: string; category: PlaceCategory; label: string }
  | { kind: "text"; query: string };

export interface GenericPlaceSearchSuggestion {
  kind: "food-tag" | "category";
  id: string;
  label: string;
  groupLabel: "Kök" | "Inriktning" | "Typ";
  searchValue: string;
}

export interface SearchablePlaceSuggestion {
  name: string;
  category: PlaceCategory;
  cuisines?: readonly string[];
  address?: string;
  area?: string;
  city?: string;
}

const CATEGORY_SEARCH_DEFINITIONS: Array<{
  category: PlaceCategory;
  aliases: string[];
}> = [
  { category: "restaurang", aliases: ["restaurang", "restauranger"] },
  { category: "café", aliases: ["café", "cafe", "caféer"] },
  { category: "bageri", aliases: ["bageri", "bagerier"] },
  { category: "snabbmat", aliases: ["snabbmat", "fast food", "fastfood"] },
  { category: "pub", aliases: ["pub", "pubar"] },
  { category: "matvagn", aliases: ["matvagn", "matvagnar", "food truck", "foodtruck"] },
];

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("sv-SE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—-]+/g, " ")
    .replace(/\s+/g, " ");
}

function categoryForExactQuery(query: string) {
  const key = normalize(query);
  return CATEGORY_SEARCH_DEFINITIONS.find(({ category, aliases }) =>
    [CATEGORY_LABEL[category], ...aliases].some((value) => normalize(value) === key),
  );
}

export function resolvePlaceSearchIntent(value: string | undefined): PlaceSearchIntent {
  const query = value?.trim() ?? "";
  if (!query) return { kind: "browse", query: "" };

  const category = categoryForExactQuery(query);
  if (category) {
    return {
      kind: "category",
      query,
      category: category.category,
      label: CATEGORY_LABEL[category.category],
    };
  }

  const tag = findFoodTag(query);
  if (tag) {
    return {
      kind: "food-tag",
      query,
      tagId: tag.id,
      label: tag.label,
      group: tag.group,
    };
  }

  return { kind: "text", query };
}

export function matchesPlaceSearchIntent(
  place: SearchablePlaceSuggestion,
  intent: PlaceSearchIntent,
): boolean {
  if (intent.kind === "browse") return true;
  if (intent.kind === "category") return place.category === intent.category;
  if (intent.kind === "food-tag") {
    return (place.cuisines ?? []).some((cuisine) =>
      findFoodTags(cuisine).some((tag) => tag.id === intent.tagId),
    );
  }

  const terms = normalize(intent.query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalize(
    [
      place.name,
      CATEGORY_LABEL[place.category],
      ...(place.cuisines ?? []),
      place.address,
      place.area,
      place.city,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

function scoreSuggestion(searchValue: string, query: string): number | null {
  const normalizedValue = normalize(searchValue);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;
  if (normalizedValue === normalizedQuery) return 0;
  if (normalizedValue.startsWith(normalizedQuery)) return 1;
  if (normalizedValue.split(" ").some((part) => part.startsWith(normalizedQuery))) return 2;
  if (normalizedValue.includes(normalizedQuery)) return 3;
  return null;
}

export function genericPlaceSearchSuggestions(
  value: string,
  limit = 6,
): GenericPlaceSearchSuggestion[] {
  const query = value.trim();
  if (query.length < 2 || limit <= 0) return [];

  const foodTags = FOOD_TAGS.flatMap((tag) => {
    const searchValue = foodTagSearchValue(tag);
    const score = scoreSuggestion(searchValue, query);
    return score == null
      ? []
      : [
          {
            score,
            suggestion: {
              kind: "food-tag" as const,
              id: tag.id,
              label: tag.label,
              groupLabel: tag.group === "cuisine" ? ("Kök" as const) : ("Inriktning" as const),
              searchValue,
            },
          },
        ];
  });

  const categories = CATEGORY_SEARCH_DEFINITIONS.flatMap(({ category, aliases }) => {
    const label = CATEGORY_LABEL[category];
    const searchValue = [label, ...aliases].join(" ");
    const score = scoreSuggestion(searchValue, query);
    return score == null
      ? []
      : [
          {
            score,
            suggestion: {
              kind: "category" as const,
              id: `category:${category}`,
              label,
              groupLabel: "Typ" as const,
              searchValue,
            },
          },
        ];
  });

  return [...foodTags, ...categories]
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.suggestion.label.localeCompare(b.suggestion.label, "sv-SE", { sensitivity: "base" }),
    )
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}
