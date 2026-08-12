import * as React from "react";
import { Clipboard, RefreshCw } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonRecord = Record<string, unknown>;

type DiagnosticCall = {
  label: string;
  status: number;
  featureCount: number;
  features: JsonRecord[];
};

type BoundaryDiagnosticResult = {
  generatedAt: string;
  query: string;
  selectedCandidate: JsonRecord | null;
  calls: DiagnosticCall[];
};

function objectValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function primitive(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
}

function featureSummary(feature: unknown): JsonRecord {
  const row = objectValue(feature) ?? {};
  const geometry = objectValue(row.geometry);
  const properties = objectValue(row.properties) ?? {};
  const datasource = objectValue(properties.datasource);
  const raw = objectValue(datasource?.raw);

  const diagnosticPropertyKeys = Object.keys(properties)
    .filter((key) => /(geometry|boundary|admin|type|place_id|feature)/iu.test(key))
    .sort();

  return {
    geometryType: primitive(geometry?.type),
    name: primitive(properties.name),
    resultType: primitive(properties.result_type),
    featureType: primitive(properties.feature_type),
    placeId: primitive(properties.place_id),
    lat: primitive(properties.lat),
    lon: primitive(properties.lon),
    osmType: primitive(raw?.osm_type),
    osmId: primitive(raw?.osm_id),
    osmBoundary: primitive(raw?.boundary),
    osmAdminLevel: primitive(raw?.admin_level),
    diagnosticPropertyKeys,
  };
}

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("GEOAPIFY_API_KEY saknas på servern.");
  return key;
}

async function diagnosticFetch(label: string, url: URL): Promise<DiagnosticCall> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = (await response.json()) as unknown;
  const record = objectValue(payload);
  const features = Array.isArray(record?.features) ? record.features : [];

  return {
    label,
    status: response.status,
    featureCount: features.length,
    features: features.slice(0, 12).map(featureSummary),
  };
}

const runBoundaryDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        query: z.string().trim().min(2).max(80).default("Nacka"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<BoundaryDiagnosticResult> => {
    const apiKey = readKey();
    const autocompleteUrl = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    autocompleteUrl.searchParams.set("text", data.query);
    autocompleteUrl.searchParams.set("filter", "countrycode:se");
    autocompleteUrl.searchParams.set("lang", "sv");
    autocompleteUrl.searchParams.set("format", "geojson");
    autocompleteUrl.searchParams.set("limit", "8");
    autocompleteUrl.searchParams.set("bias", "countrycode:se");
    autocompleteUrl.searchParams.set("apiKey", apiKey);

    const autocompleteCall = await diagnosticFetch("autocomplete", autocompleteUrl);
    const candidate = autocompleteCall.features.find((feature) => {
      const name = String(feature.name ?? "").toLocaleLowerCase("sv-SE");
      const resultType = String(feature.resultType ?? "").toLocaleLowerCase("en-US");
      return name === "nacka kommun" || (name.includes("nacka") && resultType === "municipality");
    });

    const placeId = typeof candidate?.placeId === "string" ? candidate.placeId : null;
    const lat = typeof candidate?.lat === "number" ? candidate.lat : null;
    const lon = typeof candidate?.lon === "number" ? candidate.lon : null;
    const calls: DiagnosticCall[] = [autocompleteCall];

    if (placeId) {
      for (const [label, features] of [
        ["place-details:details", "details"],
        ["place-details:details+full_geometry", "details,details.full_geometry"],
      ] as const) {
        const url = new URL("https://api.geoapify.com/v2/place-details");
        url.searchParams.set("id", placeId);
        url.searchParams.set("features", features);
        url.searchParams.set("lang", "sv");
        url.searchParams.set("apiKey", apiKey);
        calls.push(await diagnosticFetch(label, url));
      }

      const byIdUrl = new URL("https://api.geoapify.com/v1/boundaries/part-of");
      byIdUrl.searchParams.set("id", placeId);
      byIdUrl.searchParams.set("geometry", "geometry_1000");
      byIdUrl.searchParams.set("lang", "sv");
      byIdUrl.searchParams.set("apiKey", apiKey);
      calls.push(await diagnosticFetch("boundaries:part-of:id", byIdUrl));
    }

    if (lat != null && lon != null) {
      const byPointUrl = new URL("https://api.geoapify.com/v1/boundaries/part-of");
      byPointUrl.searchParams.set("lat", String(lat));
      byPointUrl.searchParams.set("lon", String(lon));
      byPointUrl.searchParams.set("geometry", "geometry_1000");
      byPointUrl.searchParams.set("lang", "sv");
      byPointUrl.searchParams.set("apiKey", apiKey);
      calls.push(await diagnosticFetch("boundaries:part-of:point", byPointUrl));
    }

    return {
      generatedAt: new Date().toISOString(),
      query: data.query,
      selectedCandidate: candidate ?? null,
      calls,
    };
  });

export const Route = createFileRoute("/boundarydiagnostik")({
  head: () => ({
    meta: [{ title: "Boundarydiagnostik · Matrundan" }],
  }),
  component: BoundaryDiagnosticsPage,
});

function BoundaryDiagnosticsPage() {
  const [result, setResult] = React.useState<BoundaryDiagnosticResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copyLabel, setCopyLabel] = React.useState("Kopiera diagnostik");

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const next = await runBoundaryDiagnostic({ data: { query: "Nacka" } });
      setResult(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diagnostiken misslyckades.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    const text = JSON.stringify(result, null, 2);
    await navigator.clipboard.writeText(text);
    setCopyLabel("Kopierat!");
    window.setTimeout(() => setCopyLabel("Kopiera diagnostik"), 1_800);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 pb-28">
      <div>
        <h1 className="font-display text-3xl font-semibold">Boundarydiagnostik</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tillfällig diagnostik för Issue #149. Den visar endast Geoapify-struktur och offentlig
          platsmetadata för Nacka kommun. API-nyckel och polygonkoordinater visas aldrig.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void run()} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> {loading ? "Kör…" : "Kör Nacka-diagnostik"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyResult()} disabled={!result}>
          <Clipboard className="h-4 w-4" /> {copyLabel}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Resultat</h2>
        <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-card-foreground">
          {result ? JSON.stringify(result, null, 2) : "Kör diagnostiken för att läsa Geoapify-svaren."}
        </pre>
      </section>
    </main>
  );
}
