import { describe, expect, test } from "bun:test";
import { emojiForCategory, isExplicitPlaceSymbol, resolvePlaceSymbol } from "./place-symbol";

describe("place-symbol", () => {
  test("låter en uttrycklig specialsymbol vinna över metadata", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Sushi"],
        photo: "🌿",
      }),
    ).toBe("🌿");
  });

  test("låter inte gamla automatiska kategorisymboler blockera bättre metadata", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Pizza"],
        photo: "☕",
      }),
    ).toBe("🍕");
  });

  test("prioriterar tydlig inriktning framför bredare kök", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Italienskt", "Pizza"],
      }),
    ).toBe("🍕");
  });

  test("är stabil när taggordningen ändras", () => {
    const first = resolvePlaceSymbol({
      category: "restaurang",
      cuisines: ["Italienskt", "Pizza"],
    });
    const second = resolvePlaceSymbol({
      category: "restaurang",
      cuisines: ["Pizza", "Italienskt"],
    });
    expect(first).toBe(second);
  });

  test("slår ihop förenliga specialiteter till samma symbol", () => {
    expect(
      resolvePlaceSymbol({
        category: "café",
        cuisines: ["Fika", "Kaffe"],
      }),
    ).toBe("☕");
    expect(
      resolvePlaceSymbol({
        category: "bageri",
        cuisines: ["Bakverk", "Wienerbröd"],
      }),
    ).toBe("🥐");
  });

  test("faller tillbaka vid motstridiga konkreta specialiteter", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Pizza", "Sushi"],
      }),
    ).toBe("🍽️");
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Pizza", "Sushi", "Italienskt"],
      }),
    ).toBe("🍽️");
  });

  test("använder ett tydligt kök när ingen konkret inriktning finns", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Italienskt"],
      }),
    ).toBe("🍝");
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Vegetariskt/veganskt"],
      }),
    ).toBe("🌿");
  });

  test("faller tillbaka när flera olika kök konkurrerar", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Italienskt", "Japanskt"],
      }),
    ).toBe("🍽️");
  });

  test("tvingar inte Internationellt eller okända metadata till en kulturell symbol", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["Internationellt", "Fusion"],
      }),
    ).toBe("🍽️");
  });

  test("förstår alias via den gemensamma food-tag-taxonomin", () => {
    expect(
      resolvePlaceSymbol({
        category: "restaurang",
        cuisines: ["pizzeria"],
      }),
    ).toBe("🍕");
  });

  test("använder verksamhetstyp som sista begripliga fallback", () => {
    expect(resolvePlaceSymbol({ category: "bageri", cuisines: [] })).toBe("🥐");
    expect(resolvePlaceSymbol({ category: "matvagn", cuisines: ["okänd"] })).toBe("🌭");
  });

  test("identifierar bara verkliga specialsymboler som uttryckliga", () => {
    expect(isExplicitPlaceSymbol("🌿")).toBe(true);
    expect(isExplicitPlaceSymbol("🍽️")).toBe(false);
    expect(isExplicitPlaceSymbol("☕")).toBe(false);
    expect(isExplicitPlaceSymbol("   ")).toBe(false);
    expect(emojiForCategory("pub")).toBe("🍺");
  });
});
