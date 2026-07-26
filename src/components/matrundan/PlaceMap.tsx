import * as React from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  waitForLeaflet,
  type LatLngTuple,
  type LeafletApi,
  type LeafletLayer,
  type LeafletLayerGroup,
  type LeafletMap,
} from "@/lib/matrundan/leaflet-global";

export interface PlaceMapItem {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  eyebrow?: string;
  description?: string;
  markerLabel?: string;
}

interface PlaceMapProps {
  items: PlaceMapItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAction?: (item: PlaceMapItem) => void;
  actionLabel?: string;
  center?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  className?: string;
  emptyText?: string;
  ariaLabel?: string;
}

const MIN_ZOOM = 3;
const MAX_ZOOM = 20;
const DEFAULT_ZOOM = 14;
const TRANSPARENT_TILE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function markerHtml(label: string, active: boolean) {
  const background = active ? "hsl(var(--primary))" : "hsl(var(--card))";
  const foreground = active ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))";
  const scale = active ? "scale(1.1)" : "scale(1)";

  return `<span style="display:grid;min-width:36px;height:36px;padding:0 10px;place-items:center;border:2px solid hsl(var(--background));border-radius:9999px;background:${background};color:${foreground};font:600 12px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 12px rgb(0 0 0 / .24);transform:${scale};transform-origin:center bottom;transition:transform 150ms ease">${escapeHtml(label)}</span>`;
}

function centerMarkerHtml() {
  return `<span style="display:grid;width:28px;height:28px;place-items:center;border:2px solid hsl(var(--background));border-radius:9999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));box-shadow:0 3px 10px rgb(0 0 0 / .22)" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="m4.93 4.93 2.12 2.12"></path><path d="m16.95 16.95 2.12 2.12"></path><path d="M2 12h3"></path><path d="M19 12h3"></path><path d="m6.34 17.66-2.12 2.12"></path><path d="m19.78 4.22-2.12 2.12"></path></svg></span>`;
}

export function PlaceMap({
  items,
  selectedId,
  onSelect,
  onAction,
  actionLabel = "Öppna",
  center,
  radiusKm,
  className,
  emptyText = "Inga platser med kartposition i den här vyn.",
  ariaLabel = "Karta över matställen",
}: PlaceMapProps) {
  const mappedItems = React.useMemo(
    () => items.filter((item) => item.lat != null && item.lng != null),
    [items],
  );
  const selected = mappedItems.find((item) => item.id === selectedId) ?? mappedItems[0] ?? null;
  const geoapifyKey = (
    import.meta as ImportMeta & {
      env?: { VITE_GEOAPIFY_MAPS_KEY?: string };
    }
  ).env?.VITE_GEOAPIFY_MAPS_KEY;
  const mapElementRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const leafletRef = React.useRef<LeafletApi | null>(null);
  const contentLayerRef = React.useRef<LeafletLayerGroup | null>(null);
  const tileLayerRef = React.useRef<LeafletLayer | null>(null);
  const tileHasLoadedRef = React.useRef(false);
  const [mapStatus, setMapStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [tileStatus, setTileStatus] = React.useState<"missing" | "loading" | "ready" | "error">(
    geoapifyKey ? "loading" : "missing",
  );
  const [viewState, setViewState] = React.useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  const fitSignature = React.useMemo(
    () =>
      [
        ...mappedItems.map((item) => `${item.id}:${item.lat}:${item.lng}`),
        center ? `center:${center.lat}:${center.lng}` : "",
      ].join("|"),
    [mappedItems, center],
  );

  React.useEffect(() => {
    let cancelled = false;
    const element = mapElementRef.current;
    if (!element) return;

    void waitForLeaflet()
      .then((leaflet) => {
        if (cancelled || !mapElementRef.current) return;
        const fallback = { lat: 57.7089, lng: 11.9746 };
        const map = leaflet.map(mapElementRef.current, {
          attributionControl: false,
          zoomControl: false,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          keyboard: true,
          boxZoom: false,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          zoomSnap: 1,
          zoomDelta: 1,
          bounceAtZoomLimits: false,
        });
        const updateViewState = () => {
          const mapCenter = map.getCenter();
          setViewState({
            lat: mapCenter.lat,
            lng: mapCenter.lng,
            zoom: map.getZoom(),
          });
        };

        map.setView([fallback.lat, fallback.lng], DEFAULT_ZOOM, {
          animate: false,
        });
        map.on("moveend", updateViewState);
        map.on("zoomend", updateViewState);
        updateViewState();
        mapRef.current = map;
        leafletRef.current = leaflet;
        setMapStatus("ready");
        requestAnimationFrame(() => map.invalidateSize({ animate: false }));
      })
      .catch((error) => {
        console.error("[Matrundan] Leaflet kunde inte startas:", error);
        if (!cancelled) setMapStatus("error");
      });

    return () => {
      cancelled = true;
      contentLayerRef.current?.remove();
      tileLayerRef.current?.remove();
      mapRef.current?.remove();
      contentLayerRef.current = null;
      tileLayerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !mapRef.current) {
      return;
    }
    if (typeof ResizeObserver === "undefined") return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(mapElementRef.current);
    return () => observer.disconnect();
  }, [mapStatus]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current || !leafletRef.current) {
      return;
    }
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    tileLayerRef.current?.remove();
    tileLayerRef.current = null;
    tileHasLoadedRef.current = false;

    if (!geoapifyKey) {
      setTileStatus("missing");
      return;
    }

    setTileStatus("loading");
    const baseUrl = "https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}";
    const retinaUrl =
      "https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}@2x.png?apiKey={apiKey}";
    const tileLayer = leaflet.tileLayer(leaflet.Browser.retina ? retinaUrl : baseUrl, {
      apiKey: geoapifyKey,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      tileSize: 256,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: true,
      errorTileUrl: TRANSPARENT_TILE,
    });
    const loadTimeout = window.setTimeout(() => {
      if (!tileHasLoadedRef.current) setTileStatus("error");
    }, 10_000);
    const handleTileLoad = () => {
      tileHasLoadedRef.current = true;
      window.clearTimeout(loadTimeout);
      setTileStatus("ready");
    };
    const handleTileError = () => {
      if (!tileHasLoadedRef.current) setTileStatus("error");
    };

    tileLayer.on("tileload", handleTileLoad);
    tileLayer.on("tileerror", handleTileError);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    return () => {
      window.clearTimeout(loadTimeout);
      tileLayer.off("tileload", handleTileLoad);
      tileLayer.off("tileerror", handleTileError);
      tileLayer.remove();
      if (tileLayerRef.current === tileLayer) tileLayerRef.current = null;
    };
  }, [geoapifyKey, mapStatus]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current || !leafletRef.current) {
      return;
    }
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    const points: LatLngTuple[] = mappedItems.map((item) => [item.lat!, item.lng!]);
    if (center) points.push([center.lat, center.lng]);
    if (points.length === 0) return;

    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      if (points.length === 1) {
        map.setView(points[0], DEFAULT_ZOOM, { animate: false });
        return;
      }
      const bounds = leaflet.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          paddingTopLeft: [48, 48],
          paddingBottomRight: [48, mappedItems.length > 0 ? 164 : 72],
          maxZoom: 15,
          animate: false,
        });
      }
    });
  }, [fitSignature, mapStatus, mappedItems.length]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current || !leafletRef.current) {
      return;
    }
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    contentLayerRef.current?.remove();
    const group = leaflet.layerGroup().addTo(map);

    if (center && radiusKm) {
      group.addLayer(
        leaflet.circle([center.lat, center.lng], {
          radius: radiusKm * 1000,
          color: "hsl(var(--primary))",
          weight: 2,
          opacity: 0.65,
          fillColor: "hsl(var(--primary))",
          fillOpacity: 0.1,
          interactive: false,
        }),
      );
    }

    if (center) {
      group.addLayer(
        leaflet.marker([center.lat, center.lng], {
          icon: leaflet.divIcon({
            html: centerMarkerHtml(),
            className: "",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          interactive: false,
          keyboard: false,
          zIndexOffset: 500,
        }),
      );
    }

    mappedItems.forEach((item, index) => {
      const active = selected?.id === item.id;
      const marker = leaflet.marker([item.lat!, item.lng!], {
        icon: leaflet.divIcon({
          html: markerHtml(String(item.markerLabel ?? index + 1), active),
          className: "",
          iconSize: [48, 46],
          iconAnchor: [24, 42],
        }),
        title: item.name,
        keyboard: true,
        interactive: true,
        riseOnHover: true,
        zIndexOffset: active ? 1000 : 0,
      });
      marker.on("click", () => onSelect?.(item.id));
      group.addLayer(marker);
    });

    contentLayerRef.current = group;
    return () => {
      group.remove();
      if (contentLayerRef.current === group) contentLayerRef.current = null;
    };
  }, [center, mappedItems, mapStatus, onSelect, radiusKm, selected]);

  if (mappedItems.length === 0 && !center) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        {emptyText}
      </div>
    );
  }

  const notice =
    mapStatus === "error"
      ? "Kartan kunde inte startas. Ladda om sidan och försök igen."
      : tileStatus === "missing"
        ? "Kartbakgrunden visas när en domänbegränsad Geoapify-nyckel är konfigurerad."
        : tileStatus === "error"
          ? "Kartbakgrunden kunde inte laddas. Kontrollera Geoapify-nyckelns domänregler."
          : tileStatus === "loading"
            ? "Laddar kartan…"
            : null;

  return (
    <div
      className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-border/70 bg-muted ${className ?? ""}`}
      role="region"
      aria-label={ariaLabel}
      data-map-ready={mapStatus === "ready"}
      data-map-zoom={viewState?.zoom ?? ""}
      data-map-lat={viewState?.lat ?? ""}
      data-map-lng={viewState?.lng ?? ""}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[size:24px_24px] opacity-70"
        aria-hidden="true"
      />
      <div
        ref={mapElementRef}
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
        aria-label="Interaktiv karta. Dra för att flytta och nyp för att zooma."
      />

      {notice ? (
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-[calc(100%-5.5rem)] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          {notice}
        </div>
      ) : null}

      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => mapRef.current?.zoomIn(1)}
          disabled={mapStatus !== "ready"}
          aria-label="Zooma in kartan"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => mapRef.current?.zoomOut(1)}
          disabled={mapStatus !== "ready"}
          aria-label="Zooma ut kartan"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {selected ? (
        <div className="absolute inset-x-3 bottom-8 z-[1000] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              {selected.eyebrow ? (
                <div className="truncate text-[11px] font-medium text-primary">
                  {selected.eyebrow}
                </div>
              ) : null}
              <div className="truncate font-medium">{selected.name}</div>
              {selected.description ? (
                <div className="truncate text-xs text-muted-foreground">{selected.description}</div>
              ) : null}
            </div>
            {onAction ? (
              <Button
                type="button"
                size="sm"
                className="min-h-11 shrink-0"
                onClick={() => onAction(selected)}
              >
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] bg-background/85 px-2 py-1 text-center text-[10px] text-muted-foreground backdrop-blur-sm">
        {geoapifyKey
          ? "Kartbilder © Geoapify · Kartdata © OpenStreetMap-bidragsgivare"
          : "Kartpositioner visas utan extern kartbakgrund"}
      </div>
    </div>
  );
}
