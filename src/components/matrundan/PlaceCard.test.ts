import { describe, expect, test } from "bun:test";

import { formatCompactPlaceAddress } from "./PlaceCard";

describe("formatCompactPlaceAddress", () => {
  test("lägger till ort när adressen inte redan innehåller den", () => {
    expect(formatCompactPlaceAddress("Stortorget 1", "Stockholm")).toBe("Stortorget 1, Stockholm");
  });

  test("dubblerar inte ort som redan finns som adressdel", () => {
    expect(
      formatCompactPlaceAddress("Nynäsvägen 302, Stockholm", "Stockholm"),
    ).toBe(
      "Nynäsvägen 302, Stockholm",
    );
  });

  test("hanterar tom adress eller ort utan extra kommatecken", () => {
    expect(formatCompactPlaceAddress("", "Stockholm")).toBe("Stockholm");
    expect(formatCompactPlaceAddress("Stortorget 1", "")).toBe("Stortorget 1");
  });
});
