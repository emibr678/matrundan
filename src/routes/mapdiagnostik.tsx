import * as React from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clipboard, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { waitForMapLibre } from "@/lib/matrundan/maplibre-client";

export const Route = createFileRoute("/mapdiagnostik")({
  head: () => ({
    meta: [{ title: "Kartdiagnostik · Matrundan" }],
  }),
  component: MapDiagnosticsPage,
});

type TestState = "idle" | "running" | "success" | "failure";

type ProbeResult = {
  label: string;
  state: TestState;
  detail: string;
};

type DiagnosticReport = {
  generatedAt: string;
  origin: string;
  userAgent: string;
  devicePixelRatio: number;
  online: boolean;
  keyPresent: boolean;
  localMap: ProbeResult;
  geoapifyMap: ProbeResult;
  rasterTile: ProbeResult;
  resources: ProbeResult[];
  canvas: Record<string, string | number | boolean | null>;
  webgl: Record<string, string | number | boolean | null>;
  map: Record<string, unknown>;
  errors: string[];
};

const TEST_CENTER = { lat: 59.2893, lng: 18.0898 };
const STYLE_PATH = "/v1/styles/osm-bright-grey/style.json";
const LOCAL_SOURCE_ID = "diagnostic-local-source";
const LOCAL_LAYER_ID = "diagnostic-local-layer";
const GEO_PROBE_SOURCE_ID = "diagnostic-geo-probe-source";
const GEO_PROBE_LAYER_ID = "diagnostic-geo-probe-layer";

function redact(value: unknown, key?: string) {
  let text = value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? "");
  if (key) text = text.split(key).join("[REDACTED]");
  return text.replace(/([?&]apiKey=)[^&\s]+/gi, "$1[REDACTED]");
}

function sanitizeUrl(value: string, key?: string) {
  try {
    const url = new URL(value, window.location.href);
    if (url.searchParams.has("apiKey")) url.searchParams.set("apiKey", "[REDACTED]");
    return redact(url.toString(), key);
  } catch {
    return redact(value, key);
  }
}

function tileCoordinates(lng: number, lat: number, zoom: number) {
  const scale = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const latitude = Math.max(Math.min(lat, 85.05112878), -85.05112878);
  const radians = (latitude * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale,
  );
  return { x, y, z: zoom };
}

function resolveTemplate(template: string, center = TEST_CENTER, zoom = 14) {
  const tile = tileCoordinates(center.lng, center.lat, zoom);
  return template
    .replaceAll("{z}", String(tile.z))
    .replaceAll("{x}", String(tile.x))
    .replaceAll("{y}", String(tile.y))
    .replaceAll("{-y}", String(2 ** tile.z - tile.y - 1))
    .replaceAll("{ratio}", "");
}

async function fetchProbe(label: string, url: string, key?: string): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
    });
    const body = await response.arrayBuffer();
    const duration = Math.round(performance.now() - started);
    const contentType = response.headers.get("content-type") ?? "okänd typ";
    return {
      label,
      state: response.ok && body.byteLength > 0 ? "success" : "failure",
      detail: `${response.status} ${response.statusText || ""} · ${body.byteLength} byte · ${contentType} · ${duration} ms · ${sanitizeUrl(url, key)}`,
    };
  } catch (error) {
    return {
      label,
      state: "failure",
      detail: `${redact(error, key)} · ${sanitizeUrl(url, key)}`,
    };
  }
}

function sourceTileTemplate(source: unknown) {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const tiles = record.tiles;
  return Array.isArray(tiles) && typeof tiles[0] === "string" ? tiles[0] : null;
}

function sourceUrl(source: unknown) {
  if (!source || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>).url;
  return typeof value === "string" ? value : null;
}

function firstFontStack(style: StyleSpecification) {
  for (const layer of style.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const textFont = layer.layout?.["text-font"];
    if (Array.isArray(textFont) && textFont.every((value) => typeof value === "string")) {
      return textFont.join(",");
    }
  }
  return "Open Sans Regular";
}

function localStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Matrundan local diagnostic",
    sources: {
      [LOCAL_SOURCE_ID]: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [TEST_CENTER.lng, TEST_CENTER.lat] },
            },
          ],
        },
      },
    },
    layers: [
      {
        id: "diagnostic-background",
        type: "background",
        paint: { "background-color": "#dbeafe" },
      },
      {
        id: LOCAL_LAYER_ID,
        type: "circle",
        source: LOCAL_SOURCE_ID,
        paint: {
          "circle-radius": 18,
          "circle-color": "#ff00aa",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 5,
        },
      },
    ],
  };
}

function statusIcon(state: TestState) {
  if (state === "running") return <Loader2 className="h-4 w-4 animate-spin" />;
  if (state === "success") return <CheckCircle2 className="h-4 w-4 text-sage-foreground" />;
  if (state === "failure") return <XCircle className="h-4 w-4 text-destructive" />;
  return null;
}

function ResultRow({ result }: { result: ProbeResult }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {statusIcon(result.state)}
        <span>{result.label}</span>
      </div>
      <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
        {result.detail}
      </p>
    </div>
  );
}

function DiagnosticMap({
  kind,
  style,
  onMap,
  onResult,
  onError,
}: {
  kind: "local" | "geoapify";
  style: StyleSpecification | string;
  onMap: (map: MapLibreMap | null) => void;
  onResult: (result: ProbeResult) => void;
  onError: (message: string) => void;
}) {
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    const timeout = window.setTimeout(() => {
      if (!disposed) {
        onResult({
          label: kind === "local" ? "Lokal MapLibre-rendering" : "Geoapify vektorkarta",
          state: "failure",
          detail: "Ingen load-event inom 20 sekunder.",
        });
      }
    }, 20_000);

    void waitForMapLibre()
      .then((mapLibre) => {
        if (disposed || !element.isConnected) return;
        map = new mapLibre.Map({
          container: element,
          style,
          center: [TEST_CENTER.lng, TEST_CENTER.lat],
          zoom: 14,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          fadeDuration: 0,
          preserveDrawingBuffer: true,
          collectResourceTiming: true,
        });
        map.touchZoomRotate.disableRotation();
        onMap(map);

        map.on("error", (event) => {
          const message = redact(event.error ?? event);
          onError(`${kind}: ${message}`);
        });

        map.on("load", () => {
          if (kind === "geoapify" && map && !map.getSource(GEO_PROBE_SOURCE_ID)) {
            map.addSource(GEO_PROBE_SOURCE_ID, {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "Point",
                      coordinates: [TEST_CENTER.lng, TEST_CENTER.lat],
                    },
                  },
                ],
              },
            });
            map.addLayer({
              id: GEO_PROBE_LAYER_ID,
              type: "circle",
              source: GEO_PROBE_SOURCE_ID,
              paint: {
                "circle-radius": 18,
                "circle-color": "#ff00aa",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 5,
              },
            });
          }

          map?.once("idle", () => {
            window.clearTimeout(timeout);
            if (disposed || !map) return;
            const styleState = map.getStyle();
            const probeFeatures = map.getLayer(
              kind === "local" ? LOCAL_LAYER_ID : GEO_PROBE_LAYER_ID,
            )
              ? map.queryRenderedFeatures({
                  layers: [kind === "local" ? LOCAL_LAYER_ID : GEO_PROBE_LAYER_ID],
                }).length
              : 0;
            onResult({
              label: kind === "local" ? "Lokal MapLibre-rendering" : "Geoapify vektorkarta",
              state: probeFeatures > 0 ? "success" : "failure",
              detail: `load + idle · ${styleState.layers?.length ?? 0} lager · ${Object.keys(styleState.sources ?? {}).length} källor · testpunkt renderad: ${probeFeatures > 0 ? "ja" : "nej"}`,
            });
          });
        });
      })
      .catch((error) => {
        window.clearTimeout(timeout);
        onError(`${kind}: ${redact(error)}`);
        onResult({
          label: kind === "local" ? "Lokal MapLibre-rendering" : "Geoapify vektorkarta",
          state: "failure",
          detail: redact(error),
        });
      });

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      map?.remove();
      onMap(null);
    };
  }, [kind, onError, onMap, onResult, style]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted">
      <div ref={elementRef} className="h-[260px] w-full [&_.maplibregl-canvas]:!h-full [&_.maplibregl-canvas]:!w-full [&_.maplibregl-canvas]:!max-w-none" />
    </div>
  );
}

function MapDiagnosticsPage() {
  const key = (
    import.meta as ImportMeta & { env?: { VITE_GEOAPIFY_MAPS_KEY?: string } }
  ).env?.VITE_GEOAPIFY_MAPS_KEY;
  const styleUrl = React.useMemo(
    () =>
      key
        ? `https://maps.geoapify.com${STYLE_PATH}?apiKey=${encodeURIComponent(key)}`
        : "",
    [key],
  );
  const [run, setRun] = React.useState(0);
  const [localMap, setLocalMap] = React.useState<MapLibreMap | null>(null);
  const [geoMap, setGeoMap] = React.useState<MapLibreMap | null>(null);
  const [localResult, setLocalResult] = React.useState<ProbeResult>({
    label: "Lokal MapLibre-rendering",
    state: "running",
    detail: "Startar lokal WebGL-karta…",
  });
  const [geoResult, setGeoResult] = React.useState<ProbeResult>({
    label: "Geoapify vektorkarta",
    state: key ? "running" : "failure",
    detail: key ? "Startar Geoapify-stil…" : "VITE_GEOAPIFY_MAPS_KEY saknas i bygget.",
  });
  const [rasterResult, setRasterResult] = React.useState<ProbeResult>({
    label: "Geoapify rastertile",
    state: key ? "running" : "failure",
    detail: key ? "Hämtar kontrolltile…" : "Nyckeln saknas.",
  });
  const [resourceResults, setResourceResults] = React.useState<ProbeResult[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [copyState, setCopyState] = React.useState("Kopiera diagnostik");

  const addError = React.useCallback(
    (message: string) => setErrors((current) => [...current.slice(-19), redact(message, key)]),
    [key],
  );
  const handleLocalMap = React.useCallback((map: MapLibreMap | null) => setLocalMap(map), []);
  const handleGeoMap = React.useCallback((map: MapLibreMap | null) => setGeoMap(map), []);
  const handleLocalResult = React.useCallback((result: ProbeResult) => setLocalResult(result), []);
  const handleGeoResult = React.useCallback((result: ProbeResult) => setGeoResult(result), []);

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;

    async function runResourceProbes() {
      setRasterResult({
        label: "Geoapify rastertile",
        state: "running",
        detail: "Hämtar kontrolltile…",
      });
      setResourceResults([]);
      const tile = tileCoordinates(TEST_CENTER.lng, TEST_CENTER.lat, 14);
      const rasterUrl = `https://maps.geoapify.com/v1/tile/osm-bright-grey/${tile.z}/${tile.x}/${tile.y}.png?apiKey=${encodeURIComponent(key)}`;
      const raster = await fetchProbe("Geoapify rastertile", rasterUrl, key);
      if (!cancelled) setRasterResult(raster);

      const results: ProbeResult[] = [];
      const styleProbe = await fetchProbe("style.json", styleUrl, key);
      results.push(styleProbe);

      try {
        const styleResponse = await fetch(styleUrl, {
          cache: "no-store",
          credentials: "omit",
          mode: "cors",
        });
        const style = (await styleResponse.json()) as StyleSpecification;
        const sources = Object.entries(style.sources ?? {});
        const firstSource = sources.find(([, source]) => {
          const type = (source as { type?: string }).type;
          return type === "vector" || type === "raster";
        });

        if (firstSource) {
          const [sourceId, source] = firstSource;
          let tileTemplate = sourceTileTemplate(source);
          const tileJsonUrl = sourceUrl(source);
          if (tileJsonUrl) {
            const absoluteTileJsonUrl = new URL(tileJsonUrl, styleUrl).toString();
            const tileJsonProbe = await fetchProbe(`TileJSON: ${sourceId}`, absoluteTileJsonUrl, key);
            results.push(tileJsonProbe);
            if (tileJsonProbe.state === "success") {
              const tileJsonResponse = await fetch(absoluteTileJsonUrl, {
                cache: "no-store",
                credentials: "omit",
                mode: "cors",
              });
              const tileJson = (await tileJsonResponse.json()) as { tiles?: string[] };
              tileTemplate = tileJson.tiles?.[0] ?? tileTemplate;
            }
          }
          if (tileTemplate) {
            const tileUrl = new URL(resolveTemplate(tileTemplate), styleUrl).toString();
            results.push(await fetchProbe(`Vektortile: ${sourceId}`, tileUrl, key));
          } else {
            results.push({
              label: `Vektortile: ${sourceId}`,
              state: "failure",
              detail: "Ingen tile-URL hittades i style eller TileJSON.",
            });
          }
        } else {
          results.push({
            label: "Vektorkälla",
            state: "failure",
            detail: "Ingen vector/raster-källa hittades i style.json.",
          });
        }

        const spriteValue = style.sprite;
        const spriteBase =
          typeof spriteValue === "string"
            ? spriteValue
            : Array.isArray(spriteValue) && typeof spriteValue[0]?.url === "string"
              ? spriteValue[0].url
              : null;
        if (spriteBase) {
          const spriteUrl = new URL(spriteBase, styleUrl).toString();
          results.push(await fetchProbe("Sprite JSON", `${spriteUrl}.json`, key));
          results.push(await fetchProbe("Sprite PNG", `${spriteUrl}.png`, key));
        }

        if (style.glyphs) {
          const glyphTemplate = new URL(style.glyphs, styleUrl).toString();
          const glyphUrl = glyphTemplate
            .replace("{fontstack}", encodeURIComponent(firstFontStack(style)))
            .replace("{range}", "0-255");
          results.push(await fetchProbe("Glyph PBF", glyphUrl, key));
        }
      } catch (error) {
        results.push({
          label: "Tolkning av style.json",
          state: "failure",
          detail: redact(error, key),
        });
      }

      if (!cancelled) setResourceResults(results);
    }

    void runResourceProbes();
    return () => {
      cancelled = true;
    };
  }, [key, run, styleUrl]);

  const report = React.useMemo<DiagnosticReport>(() => {
    const map = geoMap;
    const canvas = map?.getCanvas() ?? localMap?.getCanvas() ?? null;
    const rect = canvas?.getBoundingClientRect();
    const computed = canvas ? window.getComputedStyle(canvas) : null;
    const gl = canvas
      ? (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
        (canvas.getContext("webgl") as WebGLRenderingContext | null)
      : null;
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info") as
      | { UNMASKED_VENDOR_WEBGL: number; UNMASKED_RENDERER_WEBGL: number }
      | null;
    const style = map?.getStyle();
    const sources = Object.keys(style?.sources ?? {});
    const resourceEntries = performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("geoapify.com"))
      .slice(-30)
      .map((entry) => {
        const timing = entry as PerformanceResourceTiming;
        return `${sanitizeUrl(entry.name, key)} · ${Math.round(entry.duration)} ms · transfer ${timing.transferSize ?? 0} · encoded ${timing.encodedBodySize ?? 0}`;
      });

    return {
      generatedAt: new Date().toISOString(),
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      online: navigator.onLine,
      keyPresent: Boolean(key),
      localMap: localResult,
      geoapifyMap: geoResult,
      rasterTile: rasterResult,
      resources: resourceResults,
      canvas: {
        present: Boolean(canvas),
        attributeWidth: canvas?.width ?? null,
        attributeHeight: canvas?.height ?? null,
        rectWidth: rect ? Math.round(rect.width) : null,
        rectHeight: rect ? Math.round(rect.height) : null,
        cssWidth: computed?.width ?? null,
        cssHeight: computed?.height ?? null,
        display: computed?.display ?? null,
        visibility: computed?.visibility ?? null,
        opacity: computed?.opacity ?? null,
        zIndex: computed?.zIndex ?? null,
      },
      webgl: {
        present: Boolean(gl),
        version: gl ? String(gl.getParameter(gl.VERSION)) : null,
        shadingLanguage: gl ? String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)) : null,
        vendor: gl
          ? String(
              debugInfo
                ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
                : gl.getParameter(gl.VENDOR),
            )
          : null,
        renderer: gl
          ? String(
              debugInfo
                ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                : gl.getParameter(gl.RENDERER),
            )
          : null,
        contextLost: gl?.isContextLost() ?? null,
      },
      map: {
        present: Boolean(map),
        loaded: map?.loaded() ?? false,
        styleLoaded: map?.isStyleLoaded() ?? false,
        layerCount: style?.layers?.length ?? 0,
        sourceCount: sources.length,
        sources: sources.map((sourceId) => ({
          sourceId,
          loaded: map?.isSourceLoaded(sourceId) ?? false,
        })),
        center: map
          ? { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() }
          : null,
        resourceEntries,
      },
      errors,
    };
  }, [errors, geoMap, geoResult, key, localMap, localResult, rasterResult, resourceResults]);

  async function copyReport() {
    const text = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("Kopierat!");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopyState("Kopierat!");
    }
    window.setTimeout(() => setCopyState("Kopiera diagnostik"), 1800);
  }

  function rerun() {
    setErrors([]);
    setLocalResult({
      label: "Lokal MapLibre-rendering",
      state: "running",
      detail: "Startar om lokal WebGL-karta…",
    });
    setGeoResult({
      label: "Geoapify vektorkarta",
      state: key ? "running" : "failure",
      detail: key ? "Startar om Geoapify-stil…" : "Nyckeln saknas.",
    });
    setRun((value) => value + 1);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 pb-28">
      <div>
        <h1 className="font-display text-3xl font-semibold">Kartdiagnostik</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tillfällig intern sida. Den jämför lokal MapLibre-rendering med Geoapifys vektor- och rasterresurser. API-nyckeln visas aldrig i rapporten.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={rerun} variant="outline">
          <RefreshCw className="h-4 w-4" />
          Kör om
        </Button>
        <Button type="button" onClick={() => void copyReport()}>
          <Clipboard className="h-4 w-4" />
          {copyState}
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">1. Lokal MapLibre</h2>
        <p className="text-sm text-muted-foreground">
          Ska visa en ljusblå karta med en stor rosa punkt. Inga externa kartresurser används.
        </p>
        <DiagnosticMap
          key={`local-${run}`}
          kind="local"
          style={localStyle()}
          onMap={handleLocalMap}
          onResult={handleLocalResult}
          onError={addError}
        />
        <ResultRow result={localResult} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">2. Geoapify vektorkarta</h2>
        <p className="text-sm text-muted-foreground">
          Ska visa baskartan och en stor rosa testpunkt vid Sockenplan.
        </p>
        {key ? (
          <DiagnosticMap
            key={`geo-${run}`}
            kind="geoapify"
            style={styleUrl}
            onMap={handleGeoMap}
            onResult={handleGeoResult}
            onError={addError}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            VITE_GEOAPIFY_MAPS_KEY saknas i bygget.
          </div>
        )}
        <ResultRow result={geoResult} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">3. Resurser</h2>
        <ResultRow result={rasterResult} />
        {resourceResults.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
            Kör resurskontroller…
          </div>
        ) : (
          resourceResults.map((result) => <ResultRow key={result.label} result={result} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">4. Sammanfattning</h2>
        <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-card-foreground">
          {JSON.stringify(report, null, 2)}
        </pre>
      </section>
    </main>
  );
}
