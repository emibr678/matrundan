import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  createLocalPlaceDataReport,
  listLocalPlaceDataReports,
  normalizePlaceDataReportDescription,
  normalizePlaceDataResolutionNote,
  reviewLocalPlaceDataReport,
} from "./place-data-reports";
import type { Member, Place } from "./types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
    },
  });
});

afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

const place: Place = {
  id: "p-demo",
  name: "Testköket",
  category: "restaurang",
  cuisines: ["Svenskt"],
  occasions: ["avslappnat"],
  address: "Testgatan 1",
  city: "Stockholm",
  website: "https://testkoket.example",
  addedBy: "m1",
  addedAt: "2026-08-01",
  sources: [
    {
      provider: "openstreetmap",
      providerPlaceId: "node:123",
      status: "active",
    },
  ],
};

const reporter: Member = { id: "m1", name: "Emilia", role: "ägare" };
const reviewer: Member = { id: "m2", name: "Alex", role: "admin" };

describe("platsdatarapporter", () => {
  test("normaliserar människoskrivet underlag och stoppar för kort text", () => {
    expect(normalizePlaceDataReportDescription("  Skylten   visar att stället är stängt. ")).toBe(
      "Skylten visar att stället är stängt.",
    );
    expect(() => normalizePlaceDataReportDescription("För kort")).toThrow(
      "Beskriv felet med minst 10 tecken.",
    );
    expect(normalizePlaceDataResolutionNote("  Rättat   i gruppen. ")).toBe("Rättat i gruppen.");
    expect(normalizePlaceDataResolutionNote("   ")).toBeNull();
  });

  test("bevarar en privat ögonblicksbild och hindrar dubbel inskickning", () => {
    const first = createLocalPlaceDataReport(
      "demo-group",
      place,
      reporter,
      {
        category: "closed_or_replaced",
        description: "Stället är stängt och lokalen har en ny skylt.",
      },
      "local",
    );
    const duplicate = createLocalPlaceDataReport(
      "demo-group",
      place,
      reporter,
      {
        category: "closed_or_replaced",
        description: "Ett andra försök med samma typ av fel.",
      },
      "local",
    );

    expect(first.created).toBe(true);
    expect(duplicate).toEqual({ id: first.id, created: false });

    const [report] = listLocalPlaceDataReports("demo-group", "local");
    expect(report?.placeId).toBe("p-demo");
    expect(report?.placeName).toBe("Testköket");
    expect(report?.sources).toEqual([
      { provider: "openstreetmap", providerPlaceId: "node:123", status: "active" },
    ]);
    expect(listLocalPlaceDataReports("demo-group", "session")).toEqual([]);
  });

  test("låter admin förbereda rapporten för OSM utan att publicera den", () => {
    const created = createLocalPlaceDataReport(
      "demo-group",
      place,
      reporter,
      {
        category: "wrong_website",
        description: "Webbplatsen leder till en tidigare verksamhet.",
      },
      "session",
    );

    reviewLocalPlaceDataReport(
      "demo-group",
      created.id,
      reviewer,
      {
        status: "ready_for_osm",
        resolutionNote: "Kontrollerad mot verksamhetens egen skyltning.",
      },
      "session",
    );

    const [report] = listLocalPlaceDataReports("demo-group", "session");
    expect(report?.status).toBe("ready_for_osm");
    expect(report?.reviewerName).toBe("Alex");
    expect(report?.resolutionNote).toBe("Kontrollerad mot verksamhetens egen skyltning.");
  });
});
