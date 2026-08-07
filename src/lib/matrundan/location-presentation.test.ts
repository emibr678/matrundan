import { describe, expect, test } from "bun:test";
import { providerMessage, transientSearchAreaId } from "./add-place-v16-utils";
import { demoAutocompleteLocations } from "./demo-location-suggestions";
import { normalizeLocationFeature, resolveLocationPresentation } from "./geoapify-normalize";
import { isBroadAdministrativeSearchArea } from "./search-areas";

describe("svensk geografisk presentation", () => {
  test("rå länsbokstav ersätts av strukturerad ort och kommun", () => {
    expect(
      resolveLocationPresentation({
        name: "Stavsnäs",
        formatted: "Stavsnäs, AB",
        county: "Värmdö kommun",
        state: "Stockholms län",
        result_type: "city",
      }),
    ).toEqual({
      primaryLabel: "Stavsnäs",
      secondaryLabel: "Ort · Värmdö kommun",
      selectionLabel: "Stavsnäs, Värmdö kommun",
    });
  });

  test("svensk kommun känns igen även när providern klassificerar den som city", () => {
    const presentation = resolveLocationPresentation({
      name: "Värmdö kommun",
      formatted: "Värmdö kommun, AB",
      county: "Värmdö kommun",
      state: "Stockholms län",
      result_type: "city",
    });

    expect(presentation).toEqual({
      primaryLabel: "Värmdö kommun",
      secondaryLabel: "Kommun · Stockholms län",
      selectionLabel: "Värmdö kommun, Stockholms län",
    });
    expect(isBroadAdministrativeSearchArea("city", presentation?.selectionLabel)).toBe(true);
  });

  test("gatuadress använder verifierad gata och ort utan konstruerad adress", () => {
    expect(
      resolveLocationPresentation({
        street: "Skärgårdsvägen",
        housenumber: "8",
        city: "Gustavsberg",
        county: "Värmdö kommun",
        state: "Stockholms län",
        formatted: "Skärgårdsvägen 8, 134 30 Gustavsberg, Sverige",
        result_type: "building",
      }),
    ).toEqual({
      primaryLabel: "Skärgårdsvägen 8",
      secondaryLabel: "Adress · Gustavsberg",
      selectionLabel: "Skärgårdsvägen 8, Gustavsberg",
    });
  });

  test("ofullständig strukturerad data faller tillbaka utan providerförkortning", () => {
    expect(
      resolveLocationPresentation({
        formatted: "Stavsnäs, AB",
        result_type: "city",
      }),
    ).toEqual({
      primaryLabel: "Stavsnäs",
      secondaryLabel: "Ort",
      selectionLabel: "Stavsnäs",
    });
  });

  test("normalisering bevarar provideridentitet och koordinater", () => {
    const normalized = normalizeLocationFeature({
      properties: {
        place_id: "geoapify-stavnas",
        name: "Stavsnäs",
        formatted: "Stavsnäs, AB",
        county: "Värmdö kommun",
        state: "Stockholms län",
        result_type: "city",
        lat: 59.287,
        lon: 18.692,
      },
    });

    expect(normalized).toMatchObject({
      placeId: "geoapify-stavnas",
      label: "Stavsnäs, Värmdö kommun",
      primaryLabel: "Stavsnäs",
      secondaryLabel: "Ort · Värmdö kommun",
      lat: 59.287,
      lng: 18.692,
    });
  });

  test("demo använder samma presentation och blockerar bred administrativ träff", () => {
    const municipality = demoAutocompleteLocations("Värmdö kommun", "Stockholm").find(
      (suggestion) => suggestion.primaryLabel === "Värmdö kommun",
    );
    expect(municipality).toMatchObject({
      primaryLabel: "Värmdö kommun",
      secondaryLabel: "Kommun · Stockholms län",
      label: "Värmdö kommun, Stockholms län",
    });
    expect(isBroadAdministrativeSearchArea(municipality?.resultType, municipality?.label)).toBe(
      true,
    );
  });

  test("tillfälligt sökcenter använder ett kort lokalt id oberoende av provider-id", () => {
    const id = transientSearchAreaId("temporary", 59.287123456, 18.692987654);

    expect(id).toBe("temporary-59.287123-18.692988");
    expect(id.length).toBeLessThanOrEqual(120);
  });

  test("råa valideringsfel visas inte för användaren", () => {
    const rawValidationError = new Error(
      '[{"code":"too_big","maximum":120,"message":"String must contain at most 120 character(s)","path":["centers",1,"id"]}]',
    );

    expect(providerMessage(rawValidationError)).toBe(
      "Kunde inte genomföra sökningen. Försök igen.",
    );
  });
});