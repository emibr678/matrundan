import "maplibre-gl/dist/maplibre-gl.css";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";

export type MapLibreApi = typeof import("maplibre-gl");
export type MapLibreMap = import("maplibre-gl").Map;
export type MapLibreMarker = import("maplibre-gl").Marker;
export type MapLibreGeoJSONSource = import("maplibre-gl").GeoJSONSource;

let mapLibrePromise: Promise<MapLibreApi> | null = null;

export function waitForMapLibre(): Promise<MapLibreApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapLibre kan bara laddas i webbläsaren."));
  }

  // PlaceMap verifierar Geoapify-stil och externa kartresurser innan vyn blir klar.
  mapLibrePromise ??= import("maplibre-gl").then((mapLibre) => {
    mapLibre.setWorkerUrl(mapLibreWorkerUrl);
    mapLibre.setWorkerCount(1);
    return mapLibre;
  });

  return mapLibrePromise;
}
