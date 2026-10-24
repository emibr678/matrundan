import { searchConceptById, normalizeSearchTerm } from "./search-catalogue";
import { geoapifySearchRecipe } from "./geoapify-place-search";
import type { PlaceSearchIntent, SearchablePlaceSuggestion } from "./place-search-intent";

type SourceFeature = {
  properties?: {
    categories?: string[];
    datasource?: { raw?: Record<string, unknown> };
    conditions?: unknown;
  };
};

/** Source facts only. Never use a restaurant's name or a related national cuisine as dish proof. */
export function sourceSearchEvidence(
  feature: SourceFeature,
  intent: PlaceSearchIntent,
): SearchablePlaceSuggestion["searchEvidence"] {
  const recipe = geoapifySearchRecipe(intent);
  const concept = searchConceptById(recipe.id);
  const props = feature.properties;
  if (!concept || !props) return undefined;
  const raw = props.datasource?.raw ?? {};
  const categories = Array.isArray(props.categories)
    ? props.categories.filter((c) => typeof c === "string")
    : [];
  if (concept.profile) {
    const key = `diet:${concept.profile}`;
    const explicit =
      raw[key] === "only" ||
      categories.includes(`${concept.profile}.only`) ||
      (Array.isArray(props.conditions) && props.conditions.includes(`${concept.profile}.only`));
    return explicit ? { intentId: concept.id, kind: "profile" } : undefined;
  }
  if (
    recipe.direct.some((category) =>
      categories.some((c) => c === category || c.startsWith(`${category}.`)),
    )
  ) {
    return { intentId: concept.id, kind: concept.family ? "family" : "category" };
  }
  const values =
    typeof raw.cuisine === "string" ? raw.cuisine.split(/[;,]/).map(normalizeSearchTerm) : [];
  const tokens = new Set(concept.tokens.map(normalizeSearchTerm));
  // Category suffixes are also source facts, including fast_food.sushi when the direct recipe lacks it.
  for (const category of categories) {
    if (/^catering\.(restaurant|fast_food|cafe)\./.test(category))
      values.push(normalizeSearchTerm(category.split(".").at(-1)!));
  }
  return values.some((value) => tokens.has(value))
    ? { intentId: concept.id, kind: concept.family ? "family" : "metadata" }
    : undefined;
}

/** Strict OSM identity, independent of mutable provider place IDs. No spatial/name heuristics. */
export function sourceIdentityKey(raw: string): string | undefined {
  try {
    const data = JSON.parse(raw) as { osmType?: unknown; osmId?: unknown };
    const type = data.osmType;
    const id = String(data.osmId ?? "");
    if (["node", "way", "relation"].includes(String(type)) && /^[1-9][0-9]*$/.test(id))
      return `osm:${type}:${id}`;
  } catch {
    /* Invalid/legacy raw metadata is not identity proof. */
  }
  return undefined;
}
