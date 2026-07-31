import * as React from "react";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  waitForMapLibre,
  type MapLibreGeoJSONSource,
  type MapLibreMap,
} from "@/lib/matrundan/maplibre-client";
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

interface MultiAreaPlaceMapProps {
  items: MultiAreaMapItem[];
  centers: MultiAreaMapCenter[];
  radiusKm: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAction?: (item: MultiAreaMapItem) => void;
  className?: string;
}

type ItemProperties = {
  id: string;
  name: string;
  actionable: boolean;
};

type CenterProperties = { id: string; label: string };

const ITEM_SOURCE = "matrundan-multi-items";
const CLUSTER_LAYER = "matrundan-multi-clusters";
const CLUSTER_COUNT_LAYER = "matrundan-multi-cluster-count";
const ITEM_LAYER = "matrundan-multi-points";
const SELECTED_SOURCE = "matrundan-multi-selected";
const SELECTED_LAYER = "matrundan-multi-selected-point";
const RADIUS_SOURCE = "matrundan-multi-radii";
const RADIUS_FILL_LAYER = "matrundan-multi-radius-fill";
const RADIUS_LINE_LAYER = "matrundan-multi-radius-line";
const CENTER_SOURCE = "matrundan-multi-centers";
const CENTER_LAYER = "matrundan-multi-center-points";
const CENTER_LABEL_LAYER = "matrundan-multi-center-labels";

const EMPTY_POINTS: FeatureCollection<Point, ItemProperties> = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_CENTERS: FeatureCollection<Point, CenterProperties> = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_POLYGONS: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

function themeColor(variable: string, fallback: string): string {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function fallbackStyle(background: string): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "matrundan-multi-background", type: "background", paint: { "background-color": background } }],
  };
}

function itemsCollection(items: MultiAreaMapItem[]): FeatureCollection<Point, ItemProperties> {
  return {
    type: "FeatureCollection",
    features: items
      .filter((item) => item.lat != null && item.lng != null)
      .map((item) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [item.lng!, item.lat!] },
        properties: {
          id: item.id,
          name: item.name,
          actionable: item.actionable !== false,
        },
      })),
  };
}

function selectedCollection(item: MultiAreaMapItem | null): FeatureCollection<Point, ItemProperties> {
  if (!item || item.lat == null || item.lng == null) return EMPTY_POINTS;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [item.lng, item.lat] },
        properties: {
          id: item.id,
          name: item.name,
          actionable: item.actionable !== false,
        },
      },
    ],
  };
}

function centersCollection(centers: MultiAreaMapCenter[]): FeatureCollection<Point, CenterProperties> {
  return {
    type: "FeatureCollection",
    features: centers.map((center) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [center.lng, center.lat] },
      properties: { id: center.id, label: center.label },
    })),
  };
}

function radiiCollection(
  centers: MultiAreaMapCenter[],
  radiusKm: number,
): FeatureCollection<Polygon> {
  if (radiusKm <= 0) return EMPTY_POLYGONS;
  return {
    type: "FeatureCollection",
    features: centers.map<Feature<Polygon>>((center) => {
      const latitudeRadius = radiusKm / 111.32;
      const longitudeRadius =
        radiusKm / (111.32 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));
      const ring: [number, number][] = [];
      for (let step = 0; step <= 64; step += 1) {
        const angle = (step / 64) * Math.PI * 2;
        ring.push([
          center.lng + Math.cos(angle) * longitudeRadius,
          center.lat + Math.sin(angle) * latitudeRadius,
        ]);
      }
      return {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
      };
    }),
  };
}

export function MultiAreaPlaceMap({
  items,
  centers,
  radiusKm,
  selectedId,
  onSelect,
  onAction,
  className,
}: MultiAreaPlaceMapProps) {
  const mappedItems = React.useMemo(
    () => items.filter((item) => item.lat != null && item.lng != null),
    [items],
  );
  const selected = mappedItems.find((item) => item.id === selectedId) ?? mappedItems[0] ?? null;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const onSelectRef = React.useRef(onSelect);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const mapsKey = (
    import.meta as ImportMeta & { env?: { VITE_GEOAPIFY_MAPS_KEY?: string } }
  ).env?.VITE_GEOAPIFY_MAPS_KEY;

  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let cancelled = false;

    void waitForMapLibre()
      .then((mapLibre) => {
        if (cancelled || !element.isConnected) return;
        const background = themeColor("--muted", "#ece7df");
        const style: string | StyleSpecification = mapsKey
          ? `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${encodeURIComponent(mapsKey)}`
          : fallbackStyle(background);
        const map = new mapLibre.Map({
          container: element,
          style,
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
          if (!cancelled) setStatus("error");
        });
        mapRef.current = map;
      })
      .catch((error) => {
        console.error("[Matrundan] MapLibre kunde inte laddas:", error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
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

    if (!map.getSource(RADIUS_SOURCE)) {
      map.addSource(RADIUS_SOURCE, { type: "geojson", data: EMPTY_POLYGONS });
      map.addLayer({
        id: RADIUS_FILL_LAYER,
        type: "fill",
        source: RADIUS_SOURCE,
        paint: { "fill-color": primary, "fill-opacity": 0.09 },
      });
      map.addLayer({
        id: RADIUS_LINE_LAYER,
        type: "line",
        source: RADIUS_SOURCE,
        paint: { "line-color": primary, "line-opacity": 0.6, "line-width": 2 },
      });
    }
    if (!map.getSource(CENTER_SOURCE)) {
      map.addSource(CENTER_SOURCE, { type: "geojson", data: EMPTY_CENTERS });
      map.addLayer({
        id: CENTER_LAYER,
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
        id: CENTER_LABEL_LAYER,
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
    }
    if (!map.getSource(ITEM_SOURCE)) {
      map.addSource(ITEM_SOURCE, {
        type: "geojson",
        data: EMPTY_POINTS,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 38,
      });
      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: ITEM_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 24, 30, 28],
          "circle-color": primary,
          "circle-stroke-color": background,
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: ITEM_SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": background },
      });
      map.addLayer({
        id: ITEM_LAYER,
        type: "circle",
        source: ITEM_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 10,
          "circle-color": background,
          "circle-stroke-color": primary,
          "circle-stroke-width": 3,
        },
      });
    }
    if (!map.getSource(SELECTED_SOURCE)) {
      map.addSource(SELECTED_SOURCE, { type: "geojson", data: EMPTY_POINTS });
      map.addLayer({
        id: SELECTED_LAYER,
        type: "circle",
        source: SELECTED_SOURCE,
        paint: {
          "circle-radius": 15,
          "circle-color": background,
          "circle-stroke-color": primary,
          "circle-stroke-width": 5,
        },
      });
    }

    const handlePoint = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string") onSelectRef.current?.(id);
    };
    const handleCluster = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource(ITEM_SOURCE) as MapLibreGeoJSONSource | undefined;
      if (!source || !Number.isFinite(clusterId)) return;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 250 });
      });
    };
    map.on("click", ITEM_LAYER, handlePoint);
    map.on("click", CLUSTER_LAYER, handleCluster);
    return () => {
      map.off("click", ITEM_LAYER, handlePoint);
      map.off("click", CLUSTER_LAYER, handleCluster);
    };
  }, [status]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    (map.getSource(ITEM_SOURCE) as MapLibreGeoJSONSource | undefined)?.setData(
      itemsCollection(mappedItems),
    );
    (map.getSource(SELECTED_SOURCE) as MapLibreGeoJSONSource | undefined)?.setData(
      selectedCollection(selected),
    );
    (map.getSource(CENTER_SOURCE) as MapLibreGeoJSONSource | undefined)?.setData(
      centersCollection(centers),
    );
    (map.getSource(RADIUS_SOURCE) as MapLibreGeoJSONSource | undefined)?.setData(
      radiiCollection(centers, radiusKm),
    );
  }, [centers, mappedItems, radiusKm, selected, status]);

  const fitSignature = React.useMemo(
    () =>
      [
        ...centers.map((center) => `c:${center.id}:${center.lat}:${center.lng}`),
        ...mappedItems.map((item) => `p:${item.id}:${item.lat}:${item.lng}`),
      ].join("|"),
    [centers, mappedItems],
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const points: [number, number][] = [
      ...centers.map((center) => [center.lng, center.lat] as [number, number]),
      ...mappedItems.map((item) => [item.lng!, item.lat!] as [number, number]),
    ];
    if (points.length === 0) return;
    void waitForMapLibre().then((mapLibre) => {
      requestAnimationFrame(() => {
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
    });
  }, [fitSignature, selected, status]);

  if (mappedItems.length === 0 && centers.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground ${className ?? ""}`}>
        Välj minst ett sökområde för att visa kartan.
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-[340px] overflow-hidden rounded-2xl border border-border/70 bg-muted ${className ?? ""}`}
      role="region"
      aria-label="Karta över sökresultat och valda sökområden"
      data-map-ready={status === "ready"}
      data-search-center-count={centers.length}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {status !== "ready" ? (
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
          disabled={status !== "ready"}
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
          disabled={status !== "ready"}
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
                <div className="truncate text-[11px] font-medium text-primary">{selected.eyebrow}</div>
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
