import { describe, expect, test } from "bun:test";
import {
  genericPlaceSearchSuggestions,
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
