import { describe, expect, test } from "bun:test";

import {
  comparePlaceLocation,
  isUsableExternalLocation,
  placeLocationLabel,
  type ExternalPlaceLocation,
} from "./place-location-sync";

const external: ExternalPlaceLocation = {
  address: "Enskedevägen 98",
  area: "Gamla Enskede",
  city: "Enskede",
  lat: 59.283,
  lng: 18.07,
  osmType: "node",
  osmId: "672945364",
};

describe("kartdatajämförelse", () => {
  test("identifierar namn-som-adress som en säker adressförändring", () => {
    const diff = comparePlaceLocation(
      {
        name: "Planens restaurang",
        address: "Planens restaurang",
        area: "Gamla Enskede",
        city: "Stockholm",
        lat: 59.282,
        lng: 18.069,
      },
      external,
    );

    expect(diff).toEqual({
      addressChanged: true,
      areaChanged: false,
      cityChanged: true,
      positionChanged: true,
      hasChanges: true,
    });
  });

  test("ignorerar extern data som saknar trovärdig gatuadress", () => {
    expect(
      isUsableExternalLocation(
        { ...external, address: "Planens restaurang" },
        "Planens restaurang",
      ),
    ).toBe(false);
    expect(
      comparePlaceLocation(
        { name: "Planens restaurang", address: "", city: "Stockholm" },
        { ...external, address: "Planens restaurang" },
      ),
    ).toBeNull();
  });

  test("behandlar samma normaliserade adress och position som oförändrad", () => {
    expect(
      comparePlaceLocation(
        {
          name: "Planens restaurang",
          address: " enskedevägen   98 ",
          area: "Gamla Enskede",
          city: "Enskede",
          lat: external.lat,
          lng: external.lng,
        },
        external,
      ),
    ).toEqual({
      addressChanged: false,
      areaChanged: false,
      cityChanged: false,
      positionChanged: false,
      hasChanges: false,
    });
  });

  test("formaterar adress och ort utan teknisk källinformation", () => {
    expect(placeLocationLabel(external)).toBe("Enskedevägen 98, Enskede");
  });
});
