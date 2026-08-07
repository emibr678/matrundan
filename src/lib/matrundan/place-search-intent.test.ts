import { describe, expect, test } from "bun:test";
import {
  genericPlaceSearchSuggestions,
  matchesPlaceSearchIntent,
  resolvePlaceSearchIntent,
} from "./place-search-intent";

describe("matställessökningens intent", () => {
  test("sushi blir ett semantiskt inriktningsintent", () => {
    expect(resolvePlaceSearchIntent("sushi")).toEqual({
      kind: "food-tag",
      query: "sushi",
      tagId: "specialty:sushi",
      label: "Sushi",
      group: "specialty",
    });
  });

  test("Pasta förblir egen inriktning och gissas inte som italienskt", () => {
    expect(resolvePlaceSearchIntent("Pasta")).toEqual({
      kind: "food-tag",
      query: "Pasta",
      tagId: "specialty:pasta",
      label: "Pasta",
      group: "specialty",
    });
  });

  test("cafe utan accent blir typen café", () => {
    expect(resolvePlaceSearchIntent("cafe")).toEqual({
      kind: "category",
      query: "cafe",
      category: "café",
      label: "Café",
    });
  });

  test("ett verksamhetsnamn förblir fri textsökning", () => {
    expect(resolvePlaceSearchIntent("Päronträdets Trattoria")).toEqual({
      kind: "text",
      query: "Päronträdets Trattoria",
    });
  });

  test("tom fråga ger browsing", () => {
    expect(resolvePlaceSearchIntent("   ")).toEqual({ kind: "browse", query: "" });
  });

  test("semantiskt kök matchar normaliserade cuisines även utan ordet i namnet", () => {
    const intent = resolvePlaceSearchIntent("sushi");
    expect(
      matchesPlaceSearchIntent(
        {
          name: "Rislyktans Izakaya",
          category: "restaurang",
          cuisines: ["Japanskt", "Sushi"],
          address: "Lyktgatan 9",
          city: "Göteborg",
        },
        intent,
      ),
    ).toBe(true);
  });

  test("Pasta matchar pasta men inte enbart italienskt", () => {
    const intent = resolvePlaceSearchIntent("Pasta");
    expect(
      matchesPlaceSearchIntent(
        { name: "Pastahörnan", category: "restaurang", cuisines: ["Pasta"], city: "Göteborg" },
        intent,
      ),
    ).toBe(true);
    expect(
      matchesPlaceSearchIntent(
        {
          name: "Trattoria Uno",
          category: "restaurang",
          cuisines: ["Italienskt"],
          city: "Göteborg",
        },
        intent,
      ),
    ).toBe(false);
  });

  test("fri text kan fortfarande matcha namn och geografisk kontext", () => {
    expect(
      matchesPlaceSearchIntent(
        {
          name: "Päronträdets Trattoria",
          category: "restaurang",
          cuisines: ["Italienskt", "Pasta"],
          address: "Pärongränden 6",
          area: "Vasastan",
          city: "Göteborg",
        },
        resolvePlaceSearchIntent("päronträdets"),
      ),
    ).toBe(true);
    expect(
      matchesPlaceSearchIntent(
        {
          name: "Päronträdets Trattoria",
          category: "restaurang",
          cuisines: ["Italienskt", "Pasta"],
          address: "Pärongränden 6",
          area: "Vasastan",
          city: "Göteborg",
        },
        resolvePlaceSearchIntent("Vasastan"),
      ),
    ).toBe(true);
  });

  test("autocomplete kan föreslå både kök/inriktning och Matrundan-typ", () => {
    expect(genericPlaceSearchSuggestions("caf")).toContainEqual(
      expect.objectContaining({ kind: "category", id: "category:café", label: "Café" }),
    );
    expect(genericPlaceSearchSuggestions("sus")).toContainEqual(
      expect.objectContaining({ kind: "food-tag", id: "specialty:sushi", label: "Sushi" }),
    );
  });

  test("korta frågor producerar inte generella autocompleteförslag", () => {
    expect(genericPlaceSearchSuggestions("s")).toEqual([]);
  });
});
