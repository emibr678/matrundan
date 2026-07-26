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
  setView(
    center: LatLngTuple,
    zoom: number,
    options?: Record<string, unknown>,
  ): this;
  fitBounds(
    bounds: LeafletBounds,
    options?: Record<string, unknown>,
  ): this;
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
  marker(
    position: LatLngTuple,
    options?: Record<string, unknown>,
  ): LeafletLayer;
  circle(
    position: LatLngTuple,
    options?: Record<string, unknown>,
  ): LeafletLayer;
  divIcon(options?: Record<string, unknown>): unknown;
  latLngBounds(points: LatLngTuple[]): LeafletBounds;
}

declare global {
  interface Window {
    L?: LeafletApi;
    __matrundanLeafletPromise?: Promise<LeafletApi>;
  }
}

export const LEAFLET_VERSION = "1.9.4";
export const LEAFLET_CSS_ID = "matrundan-leaflet-css";
export const LEAFLET_SCRIPT_ID = "matrundan-leaflet-script";
export const LEAFLET_CSS_URL =
  `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
export const LEAFLET_SCRIPT_URL =
  `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
export const LEAFLET_CSS_INTEGRITY =
  "sha256-p4NxAoJBhIINfQ3ynhMZqbrPDUqjMZVJpJkzY1uZ4X4=";
export const LEAFLET_SCRIPT_INTEGRITY =
  "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

export function waitForLeaflet(): Promise<LeafletApi> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Leaflet kan bara laddas i webbläsaren."),
    );
  }
  if (window.L) return Promise.resolve(window.L);
  if (window.__matrundanLeafletPromise) {
    return window.__matrundanLeafletPromise;
  }

  const promise = new Promise<LeafletApi>((resolve, reject) => {
    const script = document.getElementById(
      LEAFLET_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (!script) {
      reject(new Error("Leaflets skripttagg saknas i dokumentet."));
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Leaflet tog för lång tid att ladda."));
    }, 10_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", finish);
      script.removeEventListener("error", fail);
    };
    const finish = () => {
      cleanup();
      if (window.L) resolve(window.L);
      else {
        reject(
          new Error(
            "Leaflet laddades utan att kart-API:t blev tillgängligt.",
          ),
        );
      }
    };
    const fail = () => {
      cleanup();
      reject(new Error("Leaflet kunde inte laddas."));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (window.L) finish();
  }).catch((error) => {
    delete window.__matrundanLeafletPromise;
    throw error;
  });

  window.__matrundanLeafletPromise = promise;
  return promise;
}
