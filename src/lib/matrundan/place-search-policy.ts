import type { PlaceSearchIntent } from "./place-search-intent";
import type { PlaceCategory } from "./types";

/**
 * Provider-independent semantic routes for search terms that do not have a
 * direct Geoapify mapping today. This is a planning/validation contract:
 * a "related" route is a candidate source, never evidence that the returned
 * place actually serves the requested dish.
 *
 * Issue #512: the adapter owns Geoapify category codes, while this module
 * owns the relationship between Matrundan's stable user-facing concepts.
 */
export type SearchExpansionPolicy =
  | {
      kind: "related";
      relatedCuisineIds?: readonly string[];
      relatedPlaceTypes?: readonly PlaceCategory[];
      includeRegionalOnlyInSweden?: boolean;
      limitation: string;
    }
  | {
      kind: "dietary";
      conditions: readonly ["vegetarian", "vegan"];
      limitation: string;
    }
  | {
      kind: "needs-evidence";
      limitation: string;
    };

const EXPANSIONS: Record<string, SearchExpansionPolicy> = {
  "cuisine:middle-eastern": {
    kind: "needs-evidence",
    limitation: "Paraplyet behöver en granskad lista över leverantörens nationella kökskoder.",
  },
  "cuisine:vegetarian-vegan": {
    kind: "dietary",
    conditions: ["vegetarian", "vegan"],
    limitation: "Vegetariska alternativ är inte samma sak som en vegetarisk eller vegansk restaurang.",
  },
  "specialty:bowl": {
    kind: "needs-evidence",
    limitation: "Poké är en möjlig delmängd men inte en synonym till alla slags bowls.",
  },
  "specialty:pasta": {
    kind: "related",
    relatedCuisineIds: ["cuisine:italian"],
    limitation: "Italienskt är ett närliggande kök, inte ett belägg för att pasta serveras.",
  },
  "specialty:falafel": {
    kind: "related",
    relatedPlaceTypes: ["snabbmat"],
    limitation: "Ett gatukök behöver inte servera falafel.",
  },
  "specialty:street-food": {
    kind: "related",
    relatedPlaceTypes: ["snabbmat", "matvagn"],
    limitation: "Street food är inte synonymt med all snabbmat.",
  },
  "specialty:home-style": {
    kind: "related",
    relatedCuisineIds: ["cuisine:swedish"],
    includeRegionalOnlyInSweden: true,
    limitation: "Regionalt får bredda husmanskost endast i verifierad svensk platskontext.",
  },
  "specialty:small-plates": {
    kind: "needs-evidence",
    limitation: "Tapas och izakaya är närliggande men inte universella synonymer.",
  },
  "specialty:pub-food": {
    kind: "related",
    relatedPlaceTypes: ["pub"],
    limitation: "En pub behöver inte servera mat.",
  },
  "specialty:fika": {
    kind: "related",
    relatedPlaceTypes: ["café", "bageri"],
    limitation: "Ett bageri är inte nödvändigtvis ett café med sittplatser.",
  },
  "specialty:pastries": {
    kind: "related",
    relatedPlaceTypes: ["bageri", "café"],
    limitation: "Ett café eller bageri är inte ett belägg för ett specifikt bakverk.",
  },
  "specialty:sourdough": {
    kind: "related",
    relatedPlaceTypes: ["bageri"],
    limitation: "Bageri garanterar inte surdegsbröd.",
  },
  "specialty:danish-pastry": {
    kind: "related",
    relatedPlaceTypes: ["bageri"],
    limitation: "Bageri garanterar inte wienerbröd; danish är ett tvetydigt alias.",
  },
};

const MATVAGN_GAP: SearchExpansionPolicy = {
  kind: "needs-evidence",
  limitation: "Food truck-kategorier måste verifieras innan all snabbmat likställs med matvagn.",
};

export function searchExpansionForIntent(intent: PlaceSearchIntent): SearchExpansionPolicy | null {
  if (intent.kind === "category") {
    return intent.category === "matvagn" ? MATVAGN_GAP : null;
  }
  if (intent.kind !== "food-tag") return null;
  return EXPANSIONS[intent.tagId] ?? null;
}

/** Explicit declarations are testable; never infer absence of an expansion as good recall. */
export function declaredSearchExpansions(): Readonly<Record<string, SearchExpansionPolicy>> {
  return EXPANSIONS;
}
