import * as React from "react";
import type { MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  waitForMapLibre,
  type MapLibreGeoJSONSource,
  type MapLibreMap,
} from "@/lib/matrundan/maplibre-client";
import {
  EMPTY_MULTI_AREA_CENTERS,
  EMPTY_MULTI_AREA_POINTS,
  EMPTY_MULTI_AREA_RADII,
  multiAreaCentersCollection,
  multiAreaItemsCollection,
  multiAreaRadiiCollection,
  multiAreaSelectedCollection,
} from "@/lib/matrundan/multi-area-map-data";
import type { PlaceCategory } from "@/lib/matrundan/types";

export interface MultiAreaMapItem {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  category?: PlaceCategory;
  eyebrow?: string;
  description?: string;
  actionable?: boolean;
}

export interface MultiAreaMapCenter {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

const SOURCE = "multi-area-items";
const CLUSTERS = "multi-area-clusters";
const COUNTS = "multi-area-counts";
const POINTS = "multi-area-points";
const POINT_ICONS = "multi-area-point-icons";
const SELECTED_SOURCE = "multi-area-selected";
const SELECTED = "multi-area-selected-point";
const SELECTED_ICON = "multi-area-selected-icon";
const CENTER_SOURCE = "multi-area-centers";
const CENTERS = "multi-area-center-points";
const CENTER_LABELS = "multi-area-center-labels";
const RADIUS_SOURCE = "multi-area-radii";
const RADIUS_FILL = "multi-area-radius-fill";
const RADIUS_LINE = "multi-area-radius-line";

function themeColor(variable: string, fallback: string) {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!value) return fallback;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return fallback;

  try {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
  } catch {
    return fallback;
  }
}

function fallbackStyle(background: string): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "multi-area-fallback",
        type: "background",
        paint: { "background-color": background },
      },
    ],
  };
}

const CATEGORY_EMOJI_EXPRESSION = [
  "match",
  ["get", "category"],
  "café",
  "☕",
  "bageri",
  "🥐",
  "snabbmat",
  "🍔",
  "pub",
  "🍺",
  "matvagn",
  "🌭",
  "🍽️",
] as const;

export function MultiAreaPlaceMap({
  items,
  centers,
  radiusKm,
  selectedId,
  onSelect,
  onAction,
  className,
}: {
  items: MultiAreaMapItem[];
  centers: MultiAreaMapCenter[];
  radiusKm: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAction?: (item: MultiAreaMapItem) => void;
  className?: string;
}) {
  const mappedItems = React.useMemo(
    () => items.filter((item) => item.lat != null && item.lng != null),
    [items],
  );
  const selected = mappedItems.find((item) => item.id === selectedId) ?? mappedItems[0] ?? null;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const selectRef = React.useRef(onSelect);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [layersReady, setLayersReady] = React.useState(false);
  const mapsKey = (import.meta as ImportMeta & { env?: { VITE_GEOAPIFY_MAPS_KEY?: string } }).env
    ?.VITE_GEOAPIFY_MAPS_KEY;

  React.useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let cancelled = false;
    setLayersReady(false);
    setStatus("loading");

    void waitForMapLibre()
      .then((mapLibre) => {
        if (cancelled || !element.isConnected) return;
        const background = themeColor("--muted", "#ece7df");
        const map = new mapLibre.Map({
          container: element,
          style: mapsKey
            ? `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${encodeURIComponent(mapsKey)}`
            : fallbackStyle(background),
          center: [18.0686, 59.3293],
          zoom: 12,
          minZoom: 3,
          maxZoom: 18,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
        });
        map.touchZoomRotate.disableRotation();
        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        map.on("error", (event) => {
          console.error("[Matrundan] Flerområdeskartan kunde inte laddas:", event.error ?? event);
          if (!cancelled) {
            setLayersReady(false);
            setStatus("error");
          }
        });
        mapRef.current = map;
      })
      .catch((error) => {
        console.error("[Matrundan] MapLibre kunde inte laddas:", error);
        if (!cancelled) {
          setLayersReady(false);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
      setLayersReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapsKey]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const primary = themeColor("--primary", "#c96342");
    const background = themeColor("--background", "#fbf5e8");
    const foreground = themeColor("--foreground", "#3d2d27");

    try {
      map.addSource(RADIUS_SOURCE, { type: "geojson", data: EMPTY_MULTI_AREA_RADII });
      map.addLayer({
        id: RADIUS_FILL,
        type: "fill",
        source: RADIUS_SOURCE,
        paint: { "fill-color": primary, "fill-opacity": 0.09 },
      });
      map.addLayer({
        id: RADIUS_LINE,
        type: "line",
        source: RADIUS_SOURCE,
        paint: { "line-color": primary, "line-opacity": 0.6, "line-width": 2 },
      });
      map.addSource(CENTER_SOURCE, { type: "geojson", data: EMPTY_MULTI_AREA_CENTERS });
      map.addLayer({
        id: CENTERS,
        type: "circle",
        source: CENTER_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": primary,
          "circle-stroke-color": background,
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: CENTER_LABELS,
        type: "symbol",
        source: CENTER_SOURCE,
        minzoom: 10,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": foreground,
          "text-halo-color": background,
          "text-halo-width": 2,
        },
      });
      map.addSource(SOURCE, {
        type: "geojson",
        data: EMPTY_MULTI_AREA_POINTS,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 38,
      });
      map.addLayer({
        id: CLUSTERS,
        type: "circle",
        source: SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 24, 30, 28],
          "circle-color": primary,
          "circle-stroke-color": background,
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: COUNTS,
        type: "symbol",
        source: SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": background },
      });
      map.addLayer({
        id: POINTS,
        type: "circle",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 14,
          "circle-color": background,
          "circle-stroke-color": primary,
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: POINT_ICONS,
        type: "symbol",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": CATEGORY_EMOJI_EXPRESSION,
          "text-size": 16,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
      });
      map.addSource(SELECTED_SOURCE, { type: "geojson", data: EMPTY_MULTI_AREA_POINTS });
      map.addLayer({
        id: SELECTED,
        type: "circle",
        source: SELECTED_SOURCE,
        paint: {
          "circle-radius": 18,
          "circle-color": background,
          "circle-stroke-color": primary,
          "circle-stroke-width": 4,
        },
      });
      map.addLayer({
        id: SELECTED_ICON,
        type: "symbol",
        source: SELECTED_SOURCE,
        layout: {
          "text-field": CATEGORY_EMOJI_EXPRESSION,
          "text-size": 19,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
      });

      const selectPoint = (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") selectRef.current?.(id);
      };
      const zoomCluster = (event: MapLayerMouseEvent) => {
        map.easeTo({
          center: event.lngLat,
          zoom: Math.min(map.getZoom() + 2, 18),
          duration: 250,
        });
      };
      map.on("click", POINTS, selectPoint);
      map.on("click", POINT_ICONS, selectPoint);
      map.on("click", CLUSTERS, zoomCluster);
      setLayersReady(true);

      return () => {
        map.off("click", POINTS, selectPoint);
        map.off("click", POINT_ICONS, selectPoint);
        map.off("click", CLUSTERS, zoomCluster);
      };
    } catch (error) {
      console.error("[Matrundan] Flerområdeskartans lager kunde inte skapas:", error);
      setLayersReady(false);
      setStatus("error");
    }
  }, [status]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !layersReady || !map) return;
    (map.getSource(SOURCE) as MapLibreGeoJSONSource)?.setData(
      multiAreaItemsCollection(mappedItems),
    );
    (map.getSource(SELECTED_SOURCE) as MapLibreGeoJSONSource)?.setData(
      multiAreaSelectedCollection(selected),
    );
    (map.getSource(CENTER_SOURCE) as MapLibreGeoJSONSource)?.setData(
      multiAreaCentersCollection(centers),
    );
    (map.getSource(RADIUS_SOURCE) as MapLibreGeoJSONSource)?.setData(
      multiAreaRadiiCollection(centers, radiusKm),
    );
  }, [centers, layersReady, mappedItems, radiusKm, selected, status]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !layersReady || !map) return;
    const points: [number, number][] = [
      ...centers.map((center) => [center.lng, center.lat] as [number, number]),
      ...mappedItems.map((item) => [item.lng!, item.lat!] as [number, number]),
    ];
    if (points.length === 0) return;
    void waitForMapLibre().then((mapLibre) => {
      map.resize();
      if (points.length === 1) {
        map.jumpTo({ center: points[0], zoom: 14 });
        return;
      }
      const bounds = points.reduce(
        (current, point) => current.extend(point),
        new mapLibre.LngLatBounds(points[0], points[0]),
      );
      map.fitBounds(bounds, {
        padding: { top: 48, right: 48, bottom: selected ? 180 : 72, left: 48 },
        maxZoom: 14,
        duration: 0,
      });
    });
  }, [centers, layersReady, mappedItems, selected, status]);

  if (mappedItems.length === 0 && centers.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        Välj minst ett sökområde för att visa kartan.
      </div>
    );
  }

  const ready = status === "ready" && layersReady;
  const tileStatus = mapsKey ? (status === "ready" ? "ready" : status) : "missing";

  return (
    <div
      className={`relative min-h-[340px] overflow-hidden rounded-2xl border border-border/70 bg-muted ${className ?? ""}`}
      role="region"
      aria-label="Karta över sökresultat och valda sökområden"
      data-map-ready={ready}
      data-map-renderer="maplibre-vector"
      data-map-tile-status={tileStatus}
      data-map-error-code={status === "error" ? "runtime" : ""}
      data-map-cluster-profile="discovery"
      data-map-cluster-radius="38"
      data-clustering-disabled-at="15"
      data-map-icon-layer={ready && mapRef.current?.getLayer(POINT_ICONS) ? "ready" : "missing"}
      data-map-category-icon-count="6"
      data-search-center-count={centers.length}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!ready ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-xl border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
          {status === "error" ? "Kartan kunde inte laddas." : "Laddar kartan…"}
        </div>
      ) : null}
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-1 rounded-xl border bg-background/90 p-1 shadow-sm">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => mapRef.current?.zoomIn({ duration: 200 })}
          disabled={!ready}
          aria-label="Zooma in kartan"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => mapRef.current?.zoomOut({ duration: 200 })}
          disabled={!ready}
          aria-label="Zooma ut kartan"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>
      {selected ? (
        <div className="absolute inset-x-3 bottom-8 z-20 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
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
            {onAction && selected.actionable !== false ? (
              <Button
                type="button"
                size="sm"
                className="min-h-11 shrink-0"
                onClick={() => onAction(selected)}
              >
                Lägg till <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-background/85 px-2 py-1 text-center text-[10px] text-muted-foreground backdrop-blur-sm">
        {mapsKey
          ? "Kartbilder © Geoapify · Kartdata © OpenStreetMap-bidragsgivare"
          : "Kartpositioner visas utan extern kartbakgrund"}
      </div>
    </div>
  );
}
