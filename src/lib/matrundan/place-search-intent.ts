import { findFoodTag, findFoodTags, type FoodTagDefinition } from "./food-tags";
import {
  SEARCH_CONCEPTS,
  RELATED_SEARCH_ROUTES,
  exactSearchConcept,
  searchConceptById,
  normalizeSearchTerm,
  relatedSearchConcepts,
  type SearchConcept,
} from "./search-catalogue";
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
  displayLabel?: string;
  relatedFrom?: string;
  hint?: string;
}

export interface SearchablePlaceSuggestion {
  name: string;
  category: PlaceCategory;
  cuisines?: readonly string[];
  searchEvidence?: {
    intentId: string;
    kind: "category" | "metadata" | "family" | "profile" | "association";
    relatedId?: string;
  };
  address?: string;
  area?: string | null;
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

  const concept = exactSearchConcept(query);
  if (concept) return intentForSearchConcept(concept, query);
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
  if (tag && ["cuisine:swedish", "cuisine:mexican-latin"].includes(tag.id)) {
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

/** Explicit category/cuisine selection is different from an identical typed name. */
export interface SelectedPlaceSearchFilter {
  kind: "food-tag" | "category";
  id: string;
}

export function resolveDiscoverySearchIntent(
  value: string | undefined,
  mode: "auto" | "literal" = "auto",
  selectedFilter?: SelectedPlaceSearchFilter,
): PlaceSearchIntent {
  if (selectedFilter) {
    const concept = searchConceptById(selectedFilter.id);
    if (
      concept &&
      concept.kind === selectedFilter.kind &&
      normalizeSearchTerm(value ?? "") === normalizeSearchTerm(concept.label)
    ) {
      return intentForSearchConcept(concept, value!.trim());
    }
  }
  const resolved = resolvePlaceSearchIntent(value);
  if (selectedFilter) {
    const matches =
      (resolved.kind === "food-tag" &&
        selectedFilter.kind === "food-tag" &&
        resolved.tagId === selectedFilter.id) ||
      (resolved.kind === "category" &&
        selectedFilter.kind === "category" &&
        `category:${resolved.category}` === selectedFilter.id);
    if (!matches) throw new Error("Det valda köket eller typen kunde inte verifieras.");
    return resolved;
  }
  return mode === "literal" && resolved.kind !== "browse"
    ? { kind: "text", query: resolved.query }
    : resolved;
}

export function matchesPlaceSearchIntent(
  place: SearchablePlaceSuggestion,
  intent: PlaceSearchIntent,
): boolean {
  return (
    matchesExactPlaceSearchIntent(place, intent) || Boolean(savedPlaceSearchEvidence(place, intent))
  );
}

/** Saved labels can support a search association, but are never rewritten. */
export function savedPlaceSearchEvidence(
  place: SearchablePlaceSuggestion,
  intent: PlaceSearchIntent,
): SearchablePlaceSuggestion["searchEvidence"] {
  const id =
    intent.kind === "food-tag"
      ? intent.tagId
      : intent.kind === "category"
        ? `category:${intent.category}`
        : "";
  if (!id) return undefined;
  if (place.searchEvidence?.intentId === id) return place.searchEvidence;
  if (matchesExactPlaceSearchIntent(place, intent)) return { intentId: id, kind: "metadata" };
  const related = relatedSearchConcepts(id).find((concept) =>
    matchesExactPlaceSearchIntent(place, intentForSearchConcept(concept, concept.label)),
  );
  return related ? { intentId: id, kind: "association", relatedId: related.id } : undefined;
}

export function searchRelevanceRank(place: Pick<SearchablePlaceSuggestion, "searchEvidence">) {
  return place.searchEvidence?.kind === "association" ? 1 : 0;
}

function matchesExactPlaceSearchIntent(
  place: SearchablePlaceSuggestion,
  intent: PlaceSearchIntent,
): boolean {
  if (intent.kind === "browse") return true;
  const id =
    intent.kind === "food-tag"
      ? intent.tagId
      : intent.kind === "category"
        ? `category:${intent.category}`
        : "";
  if (place.searchEvidence?.intentId === id && id) return true;
  const concept = searchConceptById(id);
  if (concept?.profile)
    return (place.cuisines ?? []).some(
      (c) => normalizeSearchTerm(c) === normalizeSearchTerm(concept.label),
    );
  if (concept && intent.kind === "food-tag") {
    if (concept.id === "specialty:fika")
      return place.category === "café" || place.category === "bageri";
    const legacy = findFoodTag(concept.id);
    const accepted = new Set(
      [
        concept.label,
        ...(legacy &&
        !["cuisine:swedish", "cuisine:mexican-latin", "specialty:vegetarian"].includes(legacy.id)
          ? [legacy.label]
          : []),
        ...concept.tokens,
        ...(concept.family
          ? concept.tokens.flatMap((t) => {
              const tag = findFoodTag(t);
              return tag && !["cuisine:swedish", "cuisine:mexican-latin"].includes(tag.id)
                ? [tag.label]
                : [];
            })
          : []),
      ].map(normalizeSearchTerm),
    );
    if ((place.cuisines ?? []).some((c) => accepted.has(normalizeSearchTerm(c)))) return true;
    // This layer matches facts only. Associations are applied by the separate search policy.
    return false;
  }
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

function intentForSearchConcept(concept: SearchConcept, query: string): PlaceSearchIntent {
  return concept.kind === "category" && concept.category
    ? { kind: "category", query, category: concept.category, label: concept.label }
    : { kind: "food-tag", query, tagId: concept.id, label: concept.label, group: concept.group };
}

export function genericPlaceSearchSuggestions(
  value: string,
  limit = 6,
): GenericPlaceSearchSuggestion[] {
  const q = normalizeSearchTerm(value);
  if (q.length < 2 || limit <= 0) return [];
  const suggestion = (c: SearchConcept): GenericPlaceSearchSuggestion => ({
    kind: c.kind,
    id: c.id,
    label: c.label,
    groupLabel: c.groupLabel,
    searchValue: [c.label, ...c.aliases].join(" "),
    ...(c.profile
      ? { hint: "Renodlat matställe" }
      : c.id === "category:matvagn"
        ? { hint: "Bara kända matvagnar i Matrundan" }
        : {}),
  });
  const scored = SEARCH_CONCEPTS.flatMap((c) => {
    const words = [c.label, ...c.aliases].map(normalizeSearchTerm);
    const score = words.includes(q)
      ? 0
      : words.some((w) => w.startsWith(q))
        ? 2
        : words.some((w) => w.split(" ").some((p) => p.startsWith(q)))
          ? 3
          : words.some((w) => w.includes(q))
            ? 4
            : null;
    return score == null ? [] : [{ score, c, value: suggestion(c) }];
  });
  const relatedRoutes = [
    ...RELATED_SEARCH_ROUTES,
    { terms: ["Matvagn", "Food truck", "Foodtruck"], targets: ["category:snabbmat"] },
  ];
  for (const route of relatedRoutes) {
    const term = route.terms.find((t) => normalizeSearchTerm(t) === q);
    if (!term) continue;
    for (const id of route.targets) {
      const c = searchConceptById(id)!;
      if (scored.some((s) => s.c.id === id)) continue;
      scored.push({
        score: 1,
        c,
        value: {
          ...suggestion(c),
          displayLabel: `${term} – prova ${c.label}`,
          relatedFrom: term,
          hint: "Bredare sökning",
        },
      });
    }
  }
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(a.c.surface !== "main") - Number(b.c.surface !== "main") ||
        a.c.label.localeCompare(b.c.label, "sv-SE"),
    )
    .slice(0, limit)
    .map((v) => v.value);
}

/** SQL RPC compares saved labels, never UI/search IDs. Ambiguous legacy labels cannot prove narrow intentions. */
export function canonicalSearchCuisines(intent: PlaceSearchIntent): string[] {
  if (intent.kind !== "food-tag") return [];
  const concept = searchConceptById(intent.tagId);
  if (!concept) return [findFoodTag(intent.tagId)?.label ?? intent.label];
  if (concept.profile) return [concept.label];
  const legacy = findFoodTag(concept.id);
  return [
    ...new Set([
      concept.label,
      ...(concept.family
        ? concept.tokens.flatMap((t) => {
            const tag = findFoodTag(t);
            return tag ? [tag.label] : [];
          })
        : []),
      ...(legacy &&
      !["cuisine:swedish", "cuisine:mexican-latin", "specialty:vegetarian"].includes(legacy.id)
        ? [legacy.label]
        : []),
      ...concept.tokens,
    ]),
  ].slice(0, 20);
}

/** Separate retrieval protects exact canonical candidates from a broad union's limit. */
export function canonicalRelatedSearchFilters(intent: PlaceSearchIntent) {
  const concepts = relatedSearchConcepts(intent.kind === "food-tag" ? intent.tagId : "");
  return {
    categories: concepts.flatMap((concept) => (concept.category ? [concept.category] : [])),
    cuisines: [
      ...new Set(
        concepts.flatMap((concept) =>
          canonicalSearchCuisines(intentForSearchConcept(concept, concept.label)),
        ),
      ),
    ].slice(0, 20),
  };
}
