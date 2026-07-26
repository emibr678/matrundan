import "maplibre-gl/dist/maplibre-gl.css";

export type MapLibreApi = typeof import("maplibre-gl");
export type MapLibreMap = import("maplibre-gl").Map;
export type MapLibreMarker = import("maplibre-gl").Marker;
export type MapLibreGeoJSONSource = import("maplibre-gl").GeoJSONSource;

let mapLibrePromise: Promise<MapLibreApi> | null = null;

export function waitForMapLibre(): Promise<MapLibreApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapLibre kan bara laddas i webbläsaren."));
  }

  mapLibrePromise ??= import("maplibre-gl");
  return mapLibrePromise;
}
