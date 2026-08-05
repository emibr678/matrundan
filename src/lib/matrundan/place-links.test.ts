import { describe, expect, test } from "bun:test";
import {
  googleMapsDisplayParts,
  googleMapsSearchParts,
  googleMapsSearchUrl,
  isCredibleStreetAddress,
  normalizeWebsiteUrl,
  websiteLabel,
} from "./place-links";

describe("Google Maps-sökningar", () => {
  test("tar bort duplicerat namn som felaktigt adressfält", () => {
    expect(
      googleMapsSearchParts({
        name: "Boule & Tapas",
        address: "Boule & Tapas",
        area: "Johanneshov",
        city: "Stockholm",
      }),
    ).toEqual(["Boule & Tapas", "Johanneshov", "Stockholm"]);
  });

  test("behåller riktig adress och kodar sökningen", () => {
    const url = googleMapsSearchUrl({
      name: "Testköket",
      address: "Testgatan 1",
      city: "Stockholm",
    });
    expect(decodeURIComponent(url)).toContain("Testköket, Testgatan 1, Stockholm");
  });

  test("använder koordinater som reserv när bara namnet finns", () => {
    expect(
      googleMapsSearchParts({ name: "Okänt ställe", lat: 59.1234567, lng: 18.7654321 }),
    ).toEqual(["Okänt ställe", "59.123457,18.765432"]);
  });
});

describe("platsens adress och kartetikett", () => {
  test("visar en faktisk gatuadress tillsammans med orten", () => {
    expect(isCredibleStreetAddress("Enskedevägen 98", "Planens restaurang")).toBe(true);
    expect(
      googleMapsDisplayParts({
        name: "Planens restaurang",
        address: "Enskedevägen 98",
        city: "Enskede",
      }),
    ).toEqual({
      prefix: "Enskedevägen 98, ",
      tail: "Enskede",
      hasStreetAddress: true,
    });
  });

  test("beskriver kartfunktionen när adressfältet bara innehåller ställets namn", () => {
    expect(isCredibleStreetAddress("Planens restaurang", "Planens restaurang")).toBe(false);
    expect(
      googleMapsDisplayParts({
        name: "Planens restaurang",
        address: "Planens restaurang",
        city: "Stockholm",
      }),
    ).toEqual({ tail: "Visa på karta", hasStreetAddress: false });
  });

  test("visar kartfunktionen när adressen saknas helt", () => {
    expect(
      googleMapsDisplayParts({
        name: "Planens restaurang",
        address: "",
        city: "Stockholm",
      }),
    ).toEqual({ tail: "Visa på karta", hasStreetAddress: false });
  });

  test("behandlar område utan gatuuppgift som kartlänk", () => {
    expect(isCredibleStreetAddress("Gamla Enskede")).toBe(false);
    expect(
      googleMapsDisplayParts({
        name: "Kvartersköket",
        address: "Gamla Enskede",
        city: "Stockholm",
      }),
    ).toEqual({ tail: "Visa på karta", hasStreetAddress: false });
  });
});

describe("Webbplatslänkar", () => {
  test("kompletterar en domän med https och tar bort fragment", () => {
    expect(normalizeWebsiteUrl(" www.gamlaenskedematbod.se/meny#middag ")).toBe(
      "https://www.gamlaenskedematbod.se/meny",
    );
    expect(websiteLabel("https://www.gamlaenskedematbod.se/meny")).toBe("gamlaenskedematbod.se");
  });

  test("behåller http när leverantören uttryckligen använder det", () => {
    expect(normalizeWebsiteUrl("http://example.com/boka")).toBe("http://example.com/boka");
  });

  test("avvisar osäkra protokoll, credentials och trasiga värden", () => {
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeWebsiteUrl("https://user:secret@example.com")).toBeUndefined();
    expect(normalizeWebsiteUrl("inte en webbadress")).toBeUndefined();
  });
});
