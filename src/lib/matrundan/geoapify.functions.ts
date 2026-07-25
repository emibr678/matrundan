/**
 * Server-side proxy för Geoapifys API.
 *
 * Nyckeln `GEOAPIFY_API_KEY` läses ENDAST inuti `.handler()`, aldrig på
 * modulnivå, och exponeras aldrig till klienten. Klienten anropar dessa
 * server-funktioner via TanStacks RPC och får redan normaliserade förslag
 * tillbaka.
 *
 * Autentisering: alla anrop kräver inloggad Supabase-användare (via
 * `requireSupabaseAuth`). Anonyma prospects får aldrig bränna Emils quota.
 *
 * Om nyckeln saknas kastas ett tydligt "server not configured"-fel; UI:t
 * visar då ett hint om att admin behöver lägga in nyckeln i Cloud/Secrets.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeLocationFeature,
  normalizePlaceFeature,
  type NormalizedLocationSuggestion,
  type NormalizedPlaceSuggestion,
} from "./geoapify-normalize";

const PROVIDER_ID = "geoapify" as const;

const GEOAPIFY_CATEGORIES = [
  "catering.restaurant",
  "catering.cafe",
  "catering.fast_food",
  "catering.food_court",
  "catering.pub",
  "catering.bar",
  "catering.biergarten",
  "catering.ice_cream",
  "commercial.food_and_drink.bakery",
].join(",");

class GeoapifyConfigError extends Error {
  code = "geoapify_not_configured" as const;
  constructor() {
    super(
      "Geoapify är inte konfigurerat. Be en administratör lägga in GEOAPIFY_API_KEY i Lovable Cloud → Secrets.",
    );
  }
}

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new GeoapifyConfigError();
  return key;
}

async function callGeoapify(url: URL): Promise<{ features?: unknown[] }> {
  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new Error(
      `Geoapify svarade ${res.status}${body ? `: ${body}` : ""}`,
    );
  }
  return (await res.json()) as { features?: unknown[] };
}

/**
 * Autocomplete för Plats-fältet: föreslår orter/områden i Sverige.
 */
export const geoapifyAutocompleteLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        text: z.string().min(1).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<NormalizedLocationSuggestion[]> => {
    const key = readKey();
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", data.text);
    url.searchParams.set("type", "city");
    url.searchParams.set("filter", "countrycode:se");
    url.searchParams.set("lang", "sv");
    url.searchParams.set("limit", String(data.limit ?? 6));
    url.searchParams.set("apiKey", key);

    const json = await callGeoapify(url);
    const out: NormalizedLocationSuggestion[] = [];
    for (const f of json.features ?? []) {
      const n = normalizeLocationFeature(f as { properties?: unknown });
      if (n) out.push(n);
    }
    // Deduplicate på label
    const seen = new Set<string>();
    return out.filter((x) => {
      const key = x.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

/**
 * Sök matställen i ett område via Geoapifys Places API.
 * Textparametern är valfri; utan text returneras platser inom radien.
 */
export const geoapifySearchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        text: z.string().max(120).optional(),
        lat: z.number(),
        lng: z.number(),
        /** null = hela landet; annars radie i km, 0.5–200. */
        radiusKm: z.number().min(0.5).max(200).nullable(),
        limit: z.number().int().min(1).max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<NormalizedPlaceSuggestion[]> => {
    const key = readKey();
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", GEOAPIFY_CATEGORIES);
    if (data.radiusKm != null) {
      const meters = Math.round(data.radiusKm * 1000);
      url.searchParams.set(
        "filter",
        `circle:${data.lng},${data.lat},${meters}`,
      );
    } else {
      url.searchParams.set("filter", "countrycode:se");
    }
    url.searchParams.set("bias", `proximity:${data.lng},${data.lat}`);
    if (data.text && data.text.trim()) {
      url.searchParams.set("text", data.text.trim());
    }
    url.searchParams.set("lang", "sv");
    url.searchParams.set("limit", String(data.limit ?? 20));
    url.searchParams.set("apiKey", key);

    const json = await callGeoapify(url);
    const out: NormalizedPlaceSuggestion[] = [];
    for (const f of json.features ?? []) {
      const n = normalizePlaceFeature(f as { properties?: unknown });
      if (n) out.push(n);
    }
    return out;
  });

export { PROVIDER_ID as GEOAPIFY_PROVIDER_ID };
