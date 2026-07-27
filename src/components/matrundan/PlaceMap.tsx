import * as React from "react";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, type PlaceCategory } from "@/lib/matrundan/types";
import {
  waitForMapLibre,
  type MapLibreApi,
  type MapLibreGeoJSONSource,
  type MapLibreMap,
  type MapLibreMarker,
} from "@/lib/matrundan/maplibre-client";

export interface PlaceMapItem {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  category?: PlaceCategory;
  eyebrow?: string;
  description?: string;
  markerLabel?: string;
}

type ClusterProfile = "group" | "discovery";

interface PlaceMapProps {
  items: PlaceMapItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAction?: (item: PlaceMapItem) => void;
  actionLabel?: string;
  center?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  clusterProfile?: ClusterProfile;
  className?: string;
  emptyText?: string;
  ariaLabel?: string;
}

interface PlaceProperties {
  id: string;
  name: string;
  category: PlaceCategory;
  icon: string;
}

interface ClusterMarkerEntry {
  marker: MapLibreMarker;
  element: HTMLButtonElement;
}

type MapFailureCode =
  | "webgl"
  | "style-auth"
  | "style-network"
  | "resources"
  | "worker"
  | "timeout"
  | "runtime";

const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const DEFAULT_ZOOM = 14;
const PLACE_SOURCE_ID = "matrundan-places";
const CLUSTER_LAYER_ID = "matrundan-clusters";
const POINT_LAYER_ID = "matrundan-points";
const POINT_ICON_LAYER_ID = "matrundan-point-icons";
const LABEL_LAYER_ID = "matrundan-place-labels";
const SELECTED_SOURCE_ID = "matrundan-selected-place";
const SELECTED_LAYER_ID = "matrundan-selected-place-point";
const SELECTED_ICON_LAYER_ID = "matrundan-selected-place-icon";
const RADIUS_SOURCE_ID = "matrundan-radius";
const RADIUS_FILL_LAYER_ID = "matrundan-radius-fill";
const RADIUS_LINE_LAYER_ID = "matrundan-radius-line";
const CENTER_SOURCE_ID = "matrundan-center";
const CENTER_LAYER_ID = "matrundan-center-point";
const CATEGORY_IMAGE_PREFIX = "matrundan-category-";
const PLACE_CATEGORIES = [
  "restaurang",
  "café",
  "bageri",
  "snabbmat",
  "pub",
  "matvagn",
] as const satisfies readonly PlaceCategory[];

const CLUSTER_CONFIG: Record<
  ClusterProfile,
  { maxZoom: number; radius: number; labelMinZoom: number }
> = {
  group: { maxZoom: 15, radius: 44, labelMinZoom: 15 },
  discovery: { maxZoom: 14, radius: 38, labelMinZoom: 14 },
};

const EMPTY_POINTS: FeatureCollection<Point, PlaceProperties> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_POLYGONS: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_CENTER: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

function supportsWebGl() {
  const canvas = document.createElement("canvas");
  try {
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function classifyMapFailure(error: unknown): MapFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/webgl|gpu|graphics context|context lost/i.test(message)) return "webgl";
  if (/401|403|unauthori[sz]ed|forbidden|api.?key/i.test(message)) return "style-auth";
  if (/style_resources_empty|no base map sources|tiles were not rendered/i.test(message)) {
    return "resources";
  }
  if (/worker|securityerror|content security|csp/i.test(message)) return "worker";
  if (/network|fetch|load failed|failed to load|http/i.test(message)) return "style-network";
  return "runtime";
}

function failureNotice(code: MapFailureCode | null) {
  switch (code) {
    case "webgl":
      return "Enheten kunde inte starta WebGL för kartan. Felkod: WEBGL.";
    case "style-auth":
      return "Geoapify nekade kartstilen. Kontrollera nyckelns tillåtna preview-domän. Felkod: STYLE-AUTH.";
    case "style-network":
      return "Kartstilen kunde inte hämtas från Geoapify. Felkod: STYLE-NETWORK.";
    case "resources":
      return "Kartstilen laddades men dess kartresurser kunde inte renderas. Felkod: RESOURCES.";
    case "worker":
      return "Kartmotorns worker blockerades av previewmiljön. Felkod: WORKER.";
    case "timeout":
      return "Kartmotorn svarade inte inom 15 sekunder. Felkod: TIMEOUT.";
    default:
      return "Kartan kunde inte startas. Felkod: RUNTIME.";
  }
}

function readThemeColor(variable: string, fallback: string) {
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

function makeFallbackStyle(backgroundColor: string): StyleSpecification {
  return {
    version: 8,
    name: "Matrundan fallback",
    sources: {},
    layers: [
      {
        id: "matrundan-fallback-background",
        type: "background",
        paint: { "background-color": backgroundColor },
      },
    ],
  };
}

function inferCategory(item: PlaceMapItem): PlaceCategory {
  if (item.category) return item.category;

  const marker = item.markerLabel ?? "";
  if (marker.includes("☕")) return "café";
  if (marker.includes("🥐")) return "bageri";
  if (marker.includes("🍔")) return "snabbmat";
  if (marker.includes("🍺") || marker.includes("🍷")) return "pub";
  if (marker.includes("🌭")) return "matvagn";

  const eyebrow = item.eyebrow?.toLocaleLowerCase("sv-SE") ?? "";
  for (const category of PLACE_CATEGORIES) {
    if (eyebrow.startsWith(CATEGORY_LABEL[category].toLocaleLowerCase("sv-SE"))) {
      return category;
    }
  }
  return "restaurang";
}

function iconName(category: PlaceCategory) {
  return `${CATEGORY_IMAGE_PREFIX}${category}`;
}

function drawCategoryIcon(category: PlaceCategory, color: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 56;
  canvas.height = 56;
  const context = canvas.getContext("2d");
  if (!context) return new ImageData(56, 56);

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  };

  switch (category) {
    case "café":
      context.strokeRect(14, 23, 25, 16);
      context.beginPath();
      context.arc(40, 30, 7, -Math.PI / 2, Math.PI / 2);
      context.stroke();
      line(18, 17, 18, 11);
      line(27, 17, 27, 9);
      line(36, 17, 36, 11);
      line(12, 44, 43, 44);
      break;
    case "bageri":
      context.beginPath();
      context.moveTo(12, 35);
      context.bezierCurveTo(13, 19, 23, 13, 28, 13);
      context.bezierCurveTo(39, 13, 45, 22, 44, 35);
      context.bezierCurveTo(40, 42, 17, 42, 12, 35);
      context.closePath();
      context.stroke();
      line(22, 19, 18, 29);
      line(31, 18, 27, 29);
      line(39, 22, 35, 31);
      break;
    case "snabbmat":
      context.beginPath();
      context.arc(28, 25, 15, Math.PI, 0);
      context.stroke();
      line(12, 27, 44, 27);
      line(14, 34, 42, 34);
      context.beginPath();
      context.arc(28, 34, 14, 0, Math.PI);
      context.stroke();
      break;
    case "pub":
      context.strokeRect(14, 18, 24, 25);
      context.beginPath();
      context.arc(39, 29, 8, -Math.PI / 2, Math.PI / 2);
      context.stroke();
      context.beginPath();
      context.arc(21, 18, 5, Math.PI, 0);
      context.arc(30, 18, 5, Math.PI, 0);
      context.stroke();
      break;
    case "matvagn":
      context.strokeRect(10, 18, 30, 20);
      line(40, 25, 47, 25);
      line(47, 25, 47, 38);
      line(40, 38, 47, 38);
      line(14, 24, 36, 24);
      line(15, 18, 15, 24);
      line(22, 18, 22, 24);
      line(29, 18, 29, 24);
      line(36, 18, 36, 24);
      context.beginPath();
      context.arc(18, 43, 4, 0, Math.PI * 2);
      context.arc(40, 43, 4, 0, Math.PI * 2);
      context.fill();
      break;
    case "restaurang":
    default:
      line(17, 11, 17, 45);
      line(12, 11, 12, 23);
      line(22, 11, 22, 23);
      context.beginPath();
      context.moveTo(12, 23);
      context.quadraticCurveTo(17, 28, 22, 23);
      context.stroke();
      context.beginPath();
      context.moveTo(36, 11);
      context.quadraticCurveTo(45, 19, 38, 29);
      context.lineTo(38, 45);
      context.stroke();
      break;
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function registerCategoryIcons(map: MapLibreMap, color: string) {
  for (const category of PLACE_CATEGORIES) {
    const name = iconName(category);
    if (!map.hasImage(name)) {
      map.addImage(name, drawCategoryIcon(category, color), { pixelRatio: 2 });
    }
  }
}

function placeCollection(items: PlaceMapItem[]) {
  return {
    type: "FeatureCollection",
    features: items.map<Feature<Point, PlaceProperties>>((item) => {
      const category = inferCategory(item);
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [item.lng!, item.lat!],
        },
        properties: {
          id: item.id,
          name: item.name,
          category,
          icon: iconName(category),
        },
      };
    }),
  } satisfies FeatureCollection<Point, PlaceProperties>;
}

function selectedCollection(item: PlaceMapItem | null) {
  if (item?.lat == null || item.lng == null) return EMPTY_POINTS;
  const category = inferCategory(item);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [item.lng, item.lat] },
        properties: { id: item.id, name: item.name, category, icon: iconName(category) },
      },
    ],
  } satisfies FeatureCollection<Point, PlaceProperties>;
}

function radiusCollection(
  center: { lat: number; lng: number } | null | undefined,
  radiusKm?: number | null,
) {
  if (!center || !radiusKm || radiusKm <= 0) return EMPTY_POLYGONS;

  const latitudeRadius = radiusKm / 111.32;
  const longitudeRadius =
    radiusKm / (111.32 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= 64; step += 1) {
    const angle = (step / 64) * Math.PI * 2;
    coordinates.push([
      center.lng + Math.cos(angle) * longitudeRadius,
      center.lat + Math.sin(angle) * latitudeRadius,
    ]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [coordinates] },
      },
    ],
  } satisfies FeatureCollection<Polygon>;
}

function centerCollection(center: { lat: number; lng: number } | null | undefined) {
  if (!center) return EMPTY_CENTER;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [center.lng, center.lat] },
      },
    ],
  } satisfies FeatureCollection<Point>;
}

function clearClusterMarkers(entries: Map<number, ClusterMarkerEntry>) {
  entries.forEach(({ marker }) => marker.remove());
  entries.clear();
}

export function PlaceMap({
  items,
  selectedId,
  onSelect,
  onAction,
  actionLabel = "Öppna",
  center,
  radiusKm,
  clusterProfile,
  className,
  emptyText = "Inga platser med kartposition i den här vyn.",
  ariaLabel = "Karta över matställen",
}: PlaceMapProps) {
  const profile: ClusterProfile =
    clusterProfile ?? (actionLabel === "Lägg till" ? "discovery" : "group");
  const clusterConfig = CLUSTER_CONFIG[profile];
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
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const mapLibreRef = React.useRef<MapLibreApi | null>(null);
  const clusterMarkersRef = React.useRef(new Map<number, ClusterMarkerEntry>());
  const syncClustersRef = React.useRef<(() => void) | null>(null);
  const onSelectRef = React.useRef(onSelect);
  const [mapStatus, setMapStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [mapFailure, setMapFailure] = React.useState<MapFailureCode | null>(null);
  const [tileStatus, setTileStatus] = React.useState<"missing" | "loading" | "ready" | "error">(
    geoapifyKey ? "loading" : "missing",
  );
  const [viewState, setViewState] = React.useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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

    setMapFailure(null);
    if (!supportsWebGl()) {
      setMapFailure("webgl");
      setMapStatus("error");
      if (geoapifyKey) setTileStatus("error");
      return;
    }

    void waitForMapLibre()
      .then((mapLibre) => {
        if (cancelled || !element.isConnected) return;

        const fallback = { lat: 57.7089, lng: 11.9746 };
        const muted = readThemeColor("--muted", "#ece7df");

        try {
          const style: string | StyleSpecification = geoapifyKey
            ? `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${encodeURIComponent(geoapifyKey)}`
            : makeFallbackStyle(muted);
          const map = new mapLibre.Map({
            container: element,
            style,
            center: [fallback.lng, fallback.lat],
            zoom: DEFAULT_ZOOM,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            fadeDuration: 0,
            renderWorldCopies: false,
          });
          map.touchZoomRotate.disableRotation();

          const updateViewState = () => {
            const mapCenter = map.getCenter();
            setViewState({
              lat: mapCenter.lat,
              lng: mapCenter.lng,
              zoom: map.getZoom(),
            });
          };
          let loaded = false;
          const loadTimeout = window.setTimeout(() => {
            if (!loaded && !cancelled) {
              setMapFailure("timeout");
              setMapStatus("error");
              if (geoapifyKey) setTileStatus("error");
            }
          }, 15_000);

          const handleLoad = () => {
            const renderedStyle = map.getStyle();
            if (
              geoapifyKey &&
              ((renderedStyle.layers?.length ?? 0) === 0 ||
                Object.keys(renderedStyle.sources ?? {}).length === 0)
            ) {
              setMapFailure("resources");
              setMapStatus("error");
              setTileStatus("error");
              return;
            }
            loaded = true;
            window.clearTimeout(loadTimeout);
            setMapStatus("ready");
            if (geoapifyKey) {
              setTileStatus("loading");
              const resourceTimeout = window.setTimeout(() => {
                if (!cancelled) {
                  setMapFailure("resources");
                  setMapStatus("error");
                  setTileStatus("error");
                }
              }, 10_000);
              map.once("idle", () => {
                window.clearTimeout(resourceTimeout);
                if (!cancelled) setTileStatus("ready");
              });
            } else {
              setTileStatus("missing");
            }
            updateViewState();
            map.resize();
          };
          const handleError = (event: { error?: Error }) => {
            const failure = classifyMapFailure(event.error ?? event);
            console.error("[Matrundan] MapLibre-fel:", event.error ?? event);
            if (!cancelled) {
              setMapFailure(failure);
              setMapStatus("error");
              if (geoapifyKey) setTileStatus("error");
            }
          };

          map.on("load", handleLoad);
          map.on("error", handleError);
          map.on("moveend", updateViewState);
          map.on("zoomend", updateViewState);
          mapRef.current = map;
          mapLibreRef.current = mapLibre;
        } catch (error) {
          console.error("[Matrundan] MapLibre kunde inte startas:", error);
          setMapFailure(classifyMapFailure(error));
          setMapStatus("error");
          if (geoapifyKey) setTileStatus("error");
        }
      })
      .catch((error) => {
        console.error("[Matrundan] MapLibre kunde inte laddas:", error);
        if (!cancelled) {
          setMapFailure(classifyMapFailure(error));
          setMapStatus("error");
          if (geoapifyKey) setTileStatus("error");
        }
      });

    return () => {
      cancelled = true;
      clearClusterMarkers(clusterMarkersRef.current);
      syncClustersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      mapLibreRef.current = null;
    };
  }, [geoapifyKey]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !mapRef.current) return;
    if (typeof ResizeObserver === "undefined") return;

    const map = mapRef.current;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapElementRef.current);
    return () => observer.disconnect();
  }, [mapStatus]);

  React.useEffect(() => {
    if (
      mapStatus !== "ready" ||
      !mapRef.current ||
      !mapLibreRef.current ||
      !mapElementRef.current
    ) {
      return;
    }

    const map = mapRef.current;
    const mapLibre = mapLibreRef.current;
    const primary = readThemeColor("--primary", "#c96342");
    const ink = readThemeColor("--foreground", "#3d2d27");
    const background = readThemeColor("--background", "#fbf5e8");
    registerCategoryIcons(map, primary);

    if (!map.getSource(RADIUS_SOURCE_ID)) {
      map.addSource(RADIUS_SOURCE_ID, { type: "geojson", data: EMPTY_POLYGONS });
      map.addLayer({
        id: RADIUS_FILL_LAYER_ID,
        type: "fill",
        source: RADIUS_SOURCE_ID,
        paint: { "fill-color": primary, "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: RADIUS_LINE_LAYER_ID,
        type: "line",
        source: RADIUS_SOURCE_ID,
        paint: { "line-color": primary, "line-opacity": 0.65, "line-width": 2 },
      });
    }

    if (!map.getSource(CENTER_SOURCE_ID)) {
      map.addSource(CENTER_SOURCE_ID, { type: "geojson", data: EMPTY_CENTER });
      map.addLayer({
        id: CENTER_LAYER_ID,
        type: "circle",
        source: CENTER_SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": primary,
          "circle-stroke-color": background,
          "circle-stroke-width": 3,
        },
      });
    }

    if (!map.getSource(PLACE_SOURCE_ID)) {
      map.addSource(PLACE_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_POINTS,
        cluster: true,
        clusterMaxZoom: clusterConfig.maxZoom,
        clusterRadius: clusterConfig.radius,
      });
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: PLACE_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": primary,
          "circle-opacity": 0.01,
          "circle-radius": ["step", ["get", "point_count"], 22, 10, 24, 30, 28],
        },
      });
      map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: PLACE_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 14,
          "circle-color": background,
          "circle-opacity": 0.96,
          "circle-stroke-color": primary,
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: POINT_ICON_LAYER_ID,
        type: "symbol",
        source: PLACE_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": 1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: PLACE_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        minzoom: clusterConfig.labelMinZoom,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-variable-anchor": ["left", "right", "top", "bottom"],
          "text-radial-offset": 1.45,
          "text-justify": "auto",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-optional": true,
        },
        paint: {
          "text-color": ink,
          "text-halo-color": background,
          "text-halo-width": 2,
          "text-halo-blur": 0.5,
        },
      });
    }

    if (!map.getSource(SELECTED_SOURCE_ID)) {
      map.addSource(SELECTED_SOURCE_ID, { type: "geojson", data: EMPTY_POINTS });
      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SELECTED_SOURCE_ID,
        paint: {
          "circle-radius": 18,
          "circle-color": background,
          "circle-opacity": 1,
          "circle-stroke-color": primary,
          "circle-stroke-width": 4,
        },
      });
      map.addLayer({
        id: SELECTED_ICON_LAYER_ID,
        type: "symbol",
        source: SELECTED_SOURCE_ID,
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": 1.25,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    }

    const host = mapElementRef.current.parentElement;
    host?.setAttribute("data-map-point-visual", "category-icon");
    host?.setAttribute("data-map-label-layer", map.getLayer(LABEL_LAYER_ID) ? "ready" : "missing");
    host?.setAttribute(
      "data-map-icon-layer",
      map.getLayer(POINT_ICON_LAYER_ID) && map.getLayer(SELECTED_ICON_LAYER_ID)
        ? "ready"
        : "missing",
    );
    host?.setAttribute("data-map-category-icon-count", String(PLACE_CATEGORIES.length));

    const safePadding = { top: 64, right: 48, bottom: selected ? 190 : 80, left: 48 };

    const syncClusters = () => {
      if (!map.getLayer(CLUSTER_LAYER_ID)) return;
      clearClusterMarkers(clusterMarkersRef.current);

      const features = map.queryRenderedFeatures({ layers: [CLUSTER_LAYER_ID] });
      const seen = new Set<number>();
      let largestCluster = 0;

      features.forEach((feature) => {
        if (feature.geometry.type !== "Point") return;
        const clusterId = Number(feature.properties?.cluster_id);
        const count = Number(feature.properties?.point_count);
        if (!Number.isFinite(clusterId) || !Number.isFinite(count) || seen.has(clusterId)) return;
        seen.add(clusterId);
        largestCluster = Math.max(largestCluster, count);

        const coordinates = feature.geometry.coordinates as [number, number];
        const element = document.createElement("button");
        element.type = "button";
        element.className =
          "matrundan-cluster-icon grid h-11 min-w-11 place-items-center rounded-full border-[3px] border-background bg-primary px-2 text-sm font-bold text-primary-foreground shadow-lg";
        element.dataset.clusterCount = String(count);
        element.textContent = String(count);
        element.setAttribute("aria-label", `Visa ${count} matställen`);
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const source = map.getSource(PLACE_SOURCE_ID) as MapLibreGeoJSONSource | undefined;
          if (!source) return;

          host?.setAttribute("data-map-last-cluster-padding", "safe");
          void source
            .getClusterExpansionZoom(clusterId)
            .then((expansionZoom) => {
              map.easeTo({
                center: coordinates,
                zoom: Math.min(Math.max(expansionZoom, map.getZoom() + 0.75), MAX_ZOOM),
                padding: safePadding,
                duration: 250,
              });
            })
            .catch(async (error) => {
              console.error("[Matrundan] Kunde inte läsa klustrets expansionszoom:", error);
              try {
                const leaves = await source.getClusterLeaves(
                  clusterId,
                  Math.max(Math.ceil(count), 1),
                  0,
                );
                const points = leaves.flatMap((leaf) =>
                  leaf.geometry.type === "Point"
                    ? [leaf.geometry.coordinates as [number, number]]
                    : [],
                );
                if (points.length === 0) throw new Error("Klustret saknar koordinater.");
                const bounds = points.reduce(
                  (current, point) => current.extend(point),
                  new mapLibre.LngLatBounds(points[0], points[0]),
                );
                const camera = map.cameraForBounds(bounds, {
                  padding: safePadding,
                  maxZoom: MAX_ZOOM,
                });
                map.easeTo({
                  center: camera?.center ?? coordinates,
                  zoom: Math.min(
                    Math.max(camera?.zoom ?? map.getZoom() + 1, map.getZoom() + 0.75),
                    MAX_ZOOM,
                  ),
                  padding: safePadding,
                  duration: 250,
                });
              } catch (fallbackError) {
                console.error("[Matrundan] Klustret kunde inte öppnas:", fallbackError);
                map.easeTo({
                  center: coordinates,
                  zoom: Math.min(map.getZoom() + 1.5, MAX_ZOOM),
                  padding: safePadding,
                  duration: 250,
                });
              }
            });
        });

        const marker = new mapLibre.Marker({ element, anchor: "center" })
          .setLngLat(coordinates)
          .addTo(map);
        clusterMarkersRef.current.set(clusterId, { marker, element });
      });

      const markerCount = map.getLayer(POINT_LAYER_ID)
        ? map.queryRenderedFeatures({ layers: [POINT_LAYER_ID] }).length
        : 0;
      host?.setAttribute("data-map-cluster-count", String(clusterMarkersRef.current.size));
      host?.setAttribute("data-map-largest-cluster", String(largestCluster));
      host?.setAttribute("data-map-marker-count", String(markerCount));
    };

    syncClustersRef.current = syncClusters;

    const handlePointClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string") onSelectRef.current?.(id);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const interactiveLayers = [POINT_LAYER_ID, POINT_ICON_LAYER_ID, LABEL_LAYER_ID];
    interactiveLayers.forEach((layerId) => {
      map.on("click", layerId, handlePointClick);
      map.on("mouseenter", layerId, handleEnter);
      map.on("mouseleave", layerId, handleLeave);
    });
    map.on("idle", syncClusters);
    syncClusters();

    return () => {
      interactiveLayers.forEach((layerId) => {
        map.off("click", layerId, handlePointClick);
        map.off("mouseenter", layerId, handleEnter);
        map.off("mouseleave", layerId, handleLeave);
      });
      map.off("idle", syncClusters);
      if (syncClustersRef.current === syncClusters) syncClustersRef.current = null;
      clearClusterMarkers(clusterMarkersRef.current);
    };
  }, [
    clusterConfig.labelMinZoom,
    clusterConfig.maxZoom,
    clusterConfig.radius,
    mapStatus,
    selected,
  ]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const source = mapRef.current.getSource(PLACE_SOURCE_ID) as MapLibreGeoJSONSource | undefined;
    if (!source) return;
    source.setData(placeCollection(mappedItems));
    mapElementRef.current?.parentElement?.setAttribute(
      "data-map-source-count",
      String(mappedItems.length),
    );
    mapRef.current.once("idle", () => syncClustersRef.current?.());
  }, [mappedItems, mapStatus]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const source = mapRef.current.getSource(SELECTED_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;
    source?.setData(selectedCollection(selected));
  }, [mapStatus, selected]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const radiusSource = mapRef.current.getSource(RADIUS_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;
    const centerSource = mapRef.current.getSource(CENTER_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;
    radiusSource?.setData(radiusCollection(center, radiusKm));
    centerSource?.setData(centerCollection(center));
  }, [center, mapStatus, radiusKm]);

  React.useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const map = mapRef.current;
    const points = mappedItems.map((item) => [item.lng!, item.lat!] as [number, number]);
    if (center) points.push([center.lng, center.lat]);
    if (points.length === 0) return;

    requestAnimationFrame(() => {
      map.resize();
      if (points.length === 1) {
        map.jumpTo({ center: points[0], zoom: DEFAULT_ZOOM });
        return;
      }

      const bounds = points.reduce(
        (current, point) => current.extend(point),
        new mapLibreRef.current!.LngLatBounds(points[0], points[0]),
      );
      map.fitBounds(bounds, {
        padding: { top: 48, right: 48, bottom: mappedItems.length > 0 ? 180 : 72, left: 48 },
        maxZoom: profile === "discovery" ? 14 : 15,
        duration: 0,
      });
    });
  }, [fitSignature, mapStatus, mappedItems.length, profile]);

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
      ? failureNotice(mapFailure)
      : tileStatus === "missing"
        ? "Kartbakgrunden visas när en domänbegränsad Geoapify-nyckel är konfigurerad."
        : tileStatus === "error"
          ? "Kartbakgrunden kunde inte laddas. Kontrollera Geoapify-nyckelns domänregler."
          : tileStatus === "loading"
            ? "Laddar kartan…"
            : profile === "discovery" && items.length >= 50
              ? "Visar de 50 närmaste träffarna. Sök på namn eller minska området för ett mer specifikt urval."
              : null;

  return (
    <div
      className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-border/70 bg-muted ${className ?? ""}`}
      role="region"
      aria-label={ariaLabel}
      data-map-ready={mapStatus === "ready"}
      data-map-renderer="maplibre-vector"
      data-map-zoom={viewState?.zoom ?? ""}
      data-map-lat={viewState?.lat ?? ""}
      data-map-lng={viewState?.lng ?? ""}
      data-map-tile-status={tileStatus}
      data-map-error-code={mapFailure ?? ""}
      data-map-style-layer-count={mapRef.current?.getStyle()?.layers?.length ?? 0}
      data-map-style-source-count={Object.keys(mapRef.current?.getStyle()?.sources ?? {}).length}
      data-map-cluster-profile={profile}
      data-map-cluster-radius={clusterConfig.radius}
      data-clustering-disabled-at={clusterConfig.maxZoom + 1}
    >
      {tileStatus !== "ready" ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] bg-[size:24px_24px] opacity-70"
          aria-hidden="true"
        />
      ) : null}
      <div
        ref={mapElementRef}
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
        aria-label="Interaktiv karta. Dra för att flytta och nyp för att zooma."
      />

      {notice ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-5.5rem)] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          {notice}
        </div>
      ) : null}

      <div className="absolute right-3 top-3 z-20 flex flex-col gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => mapRef.current?.zoomIn({ duration: 200 })}
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
          onClick={() => mapRef.current?.zoomOut({ duration: 200 })}
          disabled={mapStatus !== "ready"}
          aria-label="Zooma ut kartan"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {selected ? (
        <div className="absolute inset-x-3 bottom-8 z-20 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-background/85 px-2 py-1 text-center text-[10px] text-muted-foreground backdrop-blur-sm">
        {geoapifyKey
          ? "Kartbilder © Geoapify · Kartdata © OpenStreetMap-bidragsgivare"
          : "Kartpositioner visas utan extern kartbakgrund"}
      </div>
    </div>
  );
}
