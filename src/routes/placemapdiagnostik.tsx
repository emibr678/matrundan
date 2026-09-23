import * as React from "react";
import { Clipboard, RefreshCw } from "lucide-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PlaceMap } from "@/components/matrundan/PlaceMap";
import { Button } from "@/components/ui/button";
import { appPageTitle } from "@/lib/app-environment";

// Explicit Playwright/dev-harness. Production builds return 404 before rendering it.
export const Route = createFileRoute("/placemapdiagnostik")({
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound();
  },
  head: () => ({
    meta: [{ title: appPageTitle("PlaceMap-diagnostik") }],
  }),
  component: PlaceMapDiagnosticsPage,
});

const TEST_CENTER = { lat: 59.2893, lng: 18.0898 };
const TEST_ITEMS = [
  {
    id: "diagnostic-place-1",
    name: "Sockenplans testställe",
    lat: TEST_CENTER.lat,
    lng: TEST_CENTER.lng,
    eyebrow: "Diagnostik",
    description: "Matrundans riktiga PlaceMap-komponent",
  },
  {
    id: "diagnostic-place-2",
    name: "Enskede testkök",
    lat: 59.2921,
    lng: 18.0962,
    eyebrow: "Diagnostik",
    description: "Andra punkten verifierar lager och kamera",
  },
];

type Snapshot = Record<string, unknown>;

function collectSnapshot(): Snapshot {
  const region = document.querySelector<HTMLElement>(
    '[data-place-map-diagnostic] [data-map-renderer="maplibre-vector"]',
  );
  const mapElement = region?.querySelector<HTMLElement>('[aria-label^="Interaktiv karta"]');
  const canvas = region?.querySelector<HTMLCanvasElement>("canvas.maplibregl-canvas");
  const regionRect = region?.getBoundingClientRect();
  const mapRect = mapElement?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  const canvasStyle = canvas ? window.getComputedStyle(canvas) : null;
  const mapStyle = mapElement ? window.getComputedStyle(mapElement) : null;

  return {
    generatedAt: new Date().toISOString(),
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    online: navigator.onLine,
    region: {
      present: Boolean(region),
      ready: region?.dataset.mapReady ?? null,
      tileStatus: region?.dataset.mapTileStatus ?? null,
      errorCode: region?.dataset.mapErrorCode ?? null,
      renderer: region?.dataset.mapRenderer ?? null,
      zoom: region?.dataset.mapZoom ?? null,
      lat: region?.dataset.mapLat ?? null,
      lng: region?.dataset.mapLng ?? null,
      layerCount: region?.dataset.mapStyleLayerCount ?? null,
      sourceCount: region?.dataset.mapStyleSourceCount ?? null,
      rect: regionRect
        ? { width: Math.round(regionRect.width), height: Math.round(regionRect.height) }
        : null,
    },
    mapElement: {
      present: Boolean(mapElement),
      rect: mapRect
        ? { width: Math.round(mapRect.width), height: Math.round(mapRect.height) }
        : null,
      css: mapStyle
        ? {
            width: mapStyle.width,
            height: mapStyle.height,
            display: mapStyle.display,
            position: mapStyle.position,
            visibility: mapStyle.visibility,
            opacity: mapStyle.opacity,
          }
        : null,
    },
    canvas: {
      present: Boolean(canvas),
      attributeWidth: canvas?.width ?? null,
      attributeHeight: canvas?.height ?? null,
      rect: canvasRect
        ? { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) }
        : null,
      css: canvasStyle
        ? {
            width: canvasStyle.width,
            height: canvasStyle.height,
            maxWidth: canvasStyle.maxWidth,
            display: canvasStyle.display,
            position: canvasStyle.position,
            visibility: canvasStyle.visibility,
            opacity: canvasStyle.opacity,
          }
        : null,
    },
  };
}

function PlaceMapDiagnosticsPage() {
  const [snapshot, setSnapshot] = React.useState<Snapshot>({});
  const [copyLabel, setCopyLabel] = React.useState("Kopiera diagnostik");

  const refresh = React.useCallback(() => {
    setSnapshot(collectSnapshot());
  }, []);

  React.useEffect(() => {
    const timers = [250, 1_000, 3_000, 7_000].map((delay) => window.setTimeout(refresh, delay));
    const interval = window.setInterval(refresh, 2_000);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function copySnapshot() {
    const text = JSON.stringify(collectSnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopyLabel("Kopierat!");
    window.setTimeout(() => setCopyLabel("Kopiera diagnostik"), 1_800);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 pb-28">
      <div>
        <h1 className="font-display text-3xl font-semibold">PlaceMap-diagnostik</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Den riktiga komponenten från Matställen, monterad på en stabil sida utan dialog eller
          lista/karta-växling. Ingen API-nyckel visas i rapporten.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> Uppdatera mått
        </Button>
        <Button type="button" onClick={() => void copySnapshot()}>
          <Clipboard className="h-4 w-4" /> {copyLabel}
        </Button>
      </div>

      <section className="space-y-3" data-place-map-diagnostic>
        <h2 className="font-display text-xl font-semibold">Riktig PlaceMap</h2>
        <p className="text-sm text-muted-foreground">
          Baskartan, två testställen, sökcentrum och radie ska synas. Zoom och panorering ska
          fungera.
        </p>
        <PlaceMap
          items={TEST_ITEMS}
          selectedId="diagnostic-place-1"
          center={TEST_CENTER}
          radiusKm={1}
          className="h-[360px]"
          ariaLabel="Diagnostisk PlaceMap"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Mått</h2>
        <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-card-foreground">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </section>
    </main>
  );
}
