import { describe, expect, test } from "bun:test";
import { FOOD_TAGS } from "./food-tags";
import { hasStructuredGeoapifyMapping } from "./geoapify-place-search";
import { resolvePlaceSearchIntent } from "./place-search-intent";
import { declaredSearchExpansions, searchExpansionForIntent } from "./place-search-policy";
import { CATEGORY_LABEL } from "./types";

describe("Issue #512 — provideroberoende sökbreddning", () => {
  test("samtliga 37 kök/inriktningar har exakt en direkt väg eller ett uttalat fallbackbeslut", () => {
    const expansions = declaredSearchExpansions();
    const ids = FOOD_TAGS.map((tag) => tag.id);
    expect(Object.keys(expansions)).toHaveLength(13);
    expect(Object.keys(expansions).sort()).toEqual(
      ids
        .filter(
          (id) =>
            !hasStructuredGeoapifyMapping(
              resolvePlaceSearchIntent(FOOD_TAGS.find((tag) => tag.id === id)!.label),
            ),
        )
        .sort(),
    );
    for (const tag of FOOD_TAGS) {
      const intent = resolvePlaceSearchIntent(tag.label);
      const direct = hasStructuredGeoapifyMapping(intent);
      const expansion = searchExpansionForIntent(intent);
      expect(Boolean(expansion)).toBe(!direct);
      if (expansion?.kind === "related") {
        expect(
          (expansion.relatedCuisineIds?.length ?? 0) + (expansion.relatedPlaceTypes?.length ?? 0),
        ).toBeGreaterThan(0);
      }
    }
  });

  test("varje relaterat kök är ett registrerat internt begrepp, inte en providerkod", () => {
    const ids = new Set(FOOD_TAGS.map((tag) => tag.id));
    for (const policy of Object.values(declaredSearchExpansions())) {
      if (policy.kind !== "related") continue;
      for (const related of policy.relatedCuisineIds ?? []) expect(ids.has(related)).toBe(true);
      for (const type of policy.relatedPlaceTypes ?? []) {
        expect(type in CATEGORY_LABEL).toBe(true);
      }
    }
  });

  test("Pasta breddas till Italienskt, men relaterad kategori är inte exakt matfakta", () => {
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Pasta"))).toMatchObject({
      kind: "related",
      relatedCuisineIds: ["cuisine:italian"],
    });
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Pizza"))).toBeNull();
  });

  test("Husmanskost får bara en möjlig regional breddning med verifierad svensk kontext", () => {
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Husmanskost"))).toMatchObject({
      kind: "related",
      relatedCuisineIds: ["cuisine:swedish"],
      includeRegionalOnlyInSweden: true,
    });
  });

  test("Fika skiljer café/bageri från bevisat fika, Pubmat skiljer pub från köksservering", () => {
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Fika"))).toMatchObject({
      kind: "related",
      relatedPlaceTypes: ["café", "bageri"],
    });
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Pubmat"))).toMatchObject({
      kind: "related",
      relatedPlaceTypes: ["pub"],
    });
  });

  test("Vegetariskt/veganskt behandlas som kostinformation, inte nationellt kök", () => {
    expect(
      searchExpansionForIntent(resolvePlaceSearchIntent("Vegetariskt/veganskt")),
    ).toMatchObject({
      kind: "dietary",
      conditions: ["vegetarian", "vegan"],
    });
  });

  test("även Matvagn har ett uttalat beslut och inga text-/namnsökningar breddas", () => {
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Matvagn"))).toMatchObject({
      kind: "needs-evidence",
    });
    expect(searchExpansionForIntent(resolvePlaceSearchIntent("Kvarterskrogen"))).toBeNull();
  });
});
