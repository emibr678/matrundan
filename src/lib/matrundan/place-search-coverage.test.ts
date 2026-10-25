import { describe, expect, test } from "bun:test";
import { FOOD_TAGS } from "./food-tags";
import { MAIN_SEARCH_CONCEPTS, SEARCH_CONCEPTS, RELATED_SEARCH_ROUTES } from "./search-catalogue";
import { geoapifySearchRecipe } from "./geoapify-place-search";
import {
  canonicalSearchCuisines,
  genericPlaceSearchSuggestions,
  matchesPlaceSearchIntent,
  resolveDiscoverySearchIntent,
} from "./place-search-intent";

const place = (cuisines: string[]) => ({
  name: "Neutralt namn",
  category: "restaurang" as const,
  cuisines,
});

describe("Issue #512 — hela den beslutade sökkatalogen", () => {
  test("38 huvudval i tre grupper, 42 direkta komplement och känd Matvagn", () => {
    expect(MAIN_SEARCH_CONCEPTS).toHaveLength(38);
    expect(
      ["Typ", "Kök", "Inriktning"].map(
        (g) => MAIN_SEARCH_CONCEPTS.filter((c) => c.groupLabel === g).length,
      ),
    ).toEqual([5, 18, 15]);
    expect(
      SEARCH_CONCEPTS.filter((c) => c.surface === "extra" && c.id !== "category:matvagn"),
    ).toHaveLength(42);
    expect(new Set(SEARCH_CONCEPTS.map((c) => c.id)).size).toBe(81);
    expect(FOOD_TAGS).toHaveLength(37); // Saved classification vocabulary is intentionally unchanged.
  });
  test("varje huvudval och komplement når rätt val inom två förslag, även varje alias", () => {
    for (const c of SEARCH_CONCEPTS) {
      for (const word of [c.label, ...c.aliases]) {
        const choices = genericPlaceSearchSuggestions(word, 2);
        expect(
          choices.some((v) => v.id === c.id),
          `${word} → ${c.label}`,
        ).toBe(true);
      }
      const intent = resolveDiscoverySearchIntent(c.label, "auto", { kind: c.kind, id: c.id });
      expect(intent.kind).toBe(c.kind);
      const recipe = geoapifySearchRecipe(intent);
      expect(recipe.id).toBe(c.id);
      if (c.id !== "category:matvagn")
        expect(recipe.direct.length + recipe.supplement.length).toBeGreaterThan(0);
      expect([...recipe.direct, ...recipe.supplement].includes("catering.food_truck")).toBe(false);
      expect(resolveDiscoverySearchIntent(c.label, "literal").kind).toBe("text");
    }
  });
  test("alla relaterade vägar är aktiva målval med korrekt etikett och ID", () => {
    for (const route of RELATED_SEARCH_ROUTES)
      for (const term of route.terms)
        for (const target of route.targets) {
          const choice = genericPlaceSearchSuggestions(term, 8).find((c) => c.id === target)!;
          expect(choice, `${term} → ${target}`).toBeDefined();
          expect(choice.label).not.toBe(term);
          expect(() =>
            resolveDiscoverySearchIntent(choice.label, "auto", {
              kind: choice.kind,
              id: choice.id,
            }),
          ).not.toThrow();
        }
    for (const word of ["Bowl", "Poké"])
      expect(genericPlaceSearchSuggestions(word).some((c) => c.id === "search:sallad")).toBe(false);
  });
  test("historiska breda etiketter styrker inga nya smala avsikter", () => {
    for (const [query, old] of [
      ["Svenskt", "Svenskt/nordiskt"],
      ["Mexikanskt", "Mexikanskt/latinamerikanskt"],
      ["Helt vegetariskt", "Vegetariskt/veganskt"],
      ["Helt veganskt", "Vegetariskt/veganskt"],
    ]) {
      const intent = resolveDiscoverySearchIntent(query);
      expect(matchesPlaceSearchIntent(place([old]), intent)).toBe(false);
      expect(canonicalSearchCuisines(intent)).not.toContain(old);
    }
    const pasta = resolveDiscoverySearchIntent("Pasta");
    expect(matchesPlaceSearchIntent(place(["Italienskt"]), pasta)).toBe(true);
    expect(matchesPlaceSearchIntent(place(["Pasta"]), pasta)).toBe(true);
    expect(canonicalSearchCuisines(pasta)).toContain("Pasta");
    expect(canonicalSearchCuisines(pasta)).not.toContain("Italienskt"); // Separate protected retrieval.
    expect(canonicalSearchCuisines(pasta)).not.toContain("specialty:pasta");
  });
  test("inga kostalternativ eller pensionerade etiketter blir nya dolda exakta filter", () => {
    for (const term of [
      "Glutenfritt",
      "Halal",
      "Veganska alternativ",
      "Vegetariska alternativ",
      "Bowl",
      "Husmanskost",
      "cuisine:vegetarian-vegan",
    ]) {
      expect(resolveDiscoverySearchIntent(term).kind, term).toBe("text");
      expect(
        genericPlaceSearchSuggestions(term).some((c) =>
          /alternativ|halal|glutenfritt|vegetariskt\/veganskt/i.test(c.label),
        ),
      ).toBe(false);
    }
  });
});
