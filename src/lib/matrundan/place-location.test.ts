import { describe, expect, test } from "bun:test";
import { formatPlaceAddressWithCity } from "./place-location";

describe("formatPlaceAddressWithCity", () => {
  test("visar orten en gång när adressen redan slutar med orten", () => {
    expect(formatPlaceAddressWithCity("Skolvägen 3, Stockholm", "Stockholm")).toBe(
      "Skolvägen 3, Stockholm",
    );
  });

  test("jämför orten utan hänsyn till skiftläge", () => {
    expect(formatPlaceAddressWithCity("Avenyn 1, GÖTEBORG", "göteborg")).toBe("Avenyn 1, GÖTEBORG");
  });

  test("lägger till orten när den inte redan finns i adressen", () => {
    expect(formatPlaceAddressWithCity("Stationsgatan 2", "Teststad")).toBe(
      "Stationsgatan 2 · Teststad",
    );
    expect(formatPlaceAddressWithCity("Stationsgatan 2", "Teststad", ", ")).toBe(
      "Stationsgatan 2, Teststad",
    );
  });

  test("hanterar saknad adress eller ort", () => {
    expect(formatPlaceAddressWithCity("", "Stockholm")).toBe("Stockholm");
    expect(formatPlaceAddressWithCity("Skolvägen 3", "")).toBe("Skolvägen 3");
  });
});
