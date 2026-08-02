import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  createLocalPlaceSuggestionReport,
  reportableSuggestionFromPlaceSuggestion,
} from "./place-data-reports";
import type { PlaceSuggestion } from "./places-provider";
import { listOwnOpenLocalPlaceSuggestionReportKeys } from "./use-own-place-suggestion-reports";

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

const suggestion: PlaceSuggestion = {
  externalId: "geoapify:reported-123",
  provider: "geoapify",
  name: "Rapporterade restaurangen",
  category: "restaurang",
  address: "Testgatan 1",
  city: "Stockholm",
};

describe("egen rapportstatus för providerträffar", () => {
  test("visar bara den aktuella användarens aktiva rapporter", () => {
    const reportable = reportableSuggestionFromPlaceSuggestion(suggestion);
    createLocalPlaceSuggestionReport(
      "demo-group",
      reportable,
      { id: "m1", name: "Emilia", role: "medlem" },
      {
        category: "closed_or_replaced",
        description: "Restaurangen har stängt och lokalen står tom.",
      },
      "local",
    );

    expect(listOwnOpenLocalPlaceSuggestionReportKeys("demo-group", "m1", "local")).toEqual([
      "provider:geoapify:geoapify:reported-123",
    ]);
    expect(listOwnOpenLocalPlaceSuggestionReportKeys("demo-group", "m2", "local")).toEqual([]);
    expect(listOwnOpenLocalPlaceSuggestionReportKeys("annan-grupp", "m1", "local")).toEqual([]);
  });
});
