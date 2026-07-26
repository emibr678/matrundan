import "leaflet/dist/leaflet.css";

export type LatLngTuple = [number, number];
export type LeafletHandler = () => void;

type LeafletTarget = LeafletMap | LeafletLayerGroup;

export interface LeafletLayer {
  addTo(target: LeafletTarget): this;
  remove(): this;
  on(event: string, handler: LeafletHandler): this;
  off(event: string, handler: LeafletHandler): this;
}

export interface LeafletLayerGroup extends LeafletLayer {
  addLayer(layer: LeafletLayer): this;
}

export interface LeafletMap {
  setView(center: LatLngTuple, zoom: number, options?: Record<string, unknown>): this;
  fitBounds(bounds: LeafletBounds, options?: Record<string, unknown>): this;
  zoomIn(delta?: number): this;
  zoomOut(delta?: number): this;
  getZoom(): number;
  getCenter(): { lat: number; lng: number };
  invalidateSize(options?: Record<string, unknown>): this;
  on(event: string, handler: LeafletHandler): this;
  off(event: string, handler: LeafletHandler): this;
  remove(): void;
}

export interface LeafletBounds {
  isValid(): boolean;
}

export interface LeafletApi {
  Browser: { retina: boolean };
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options?: Record<string, unknown>): LeafletLayer;
  layerGroup(): LeafletLayerGroup;
  marker(position: LatLngTuple, options?: Record<string, unknown>): LeafletLayer;
  circle(position: LatLngTuple, options?: Record<string, unknown>): LeafletLayer;
  divIcon(options?: Record<string, unknown>): unknown;
  latLngBounds(points: LatLngTuple[]): LeafletBounds;
}

let leafletPromise: Promise<LeafletApi> | null = null;

export function waitForLeaflet(): Promise<LeafletApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet kan bara laddas i webbläsaren."));
  }

  leafletPromise ??= import("leaflet").then(
    (module) => (module.default ?? module) as unknown as LeafletApi,
  );
  return leafletPromise;
}
