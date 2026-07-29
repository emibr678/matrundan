import { describe, expect, test } from "bun:test";
import { EXAMPLE_STATE } from "./example-data";

const FORMER_REAL_PLACE_NAMES = [
  "Pelikan",
  "Café Pascal",
  "La Neta City",
  "Lillebrors Bageri",
  "Hermans",
  "Meatballs for the People",
  "Falloumi",
  "K25",
  "Restaurang Kvarnen",
];

describe("publik exempeldata", () => {
  test("använder enbart manuella, fiktiva matställen", () => {
    expect(EXAMPLE_STATE.places).toHaveLength(9);
    expect(EXAMPLE_STATE.places.every((place) => place.origin === "manual")).toBe(true);

    const names = EXAMPLE_STATE.places.map((place) => place.name);
    for (const realName of FORMER_REAL_PLACE_NAMES) {
      expect(names).not.toContain(realName);
    }
  });

  test("aktivitet och kommentarer nämner inte tidigare verkliga namn", () => {
    const text = [
      ...EXAMPLE_STATE.activity.map((activity) => activity.text),
      ...EXAMPLE_STATE.visits.map((visit) => visit.comment ?? ""),
    ].join(" ");

    for (const realName of FORMER_REAL_PLACE_NAMES) {
      expect(text).not.toContain(realName);
    }
  });
});
