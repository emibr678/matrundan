import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type {
  MultiAreaMapCenter,
  MultiAreaMapItem,
} from "@/components/matrundan/MultiAreaPlaceMap";
import type { PlaceCategory } from "./types";

export type MultiAreaItemProperties = {
  id: string;
  name: string;
  actionable: boolean;
  category: PlaceCategory;
};

export type MultiAreaCenterProperties = { id: string; label: string };

export const EMPTY_MULTI_AREA_POINTS: FeatureCollection<Point, MultiAreaItemProperties> = {
  type: "FeatureCollection",
  features: [],
};

export const EMPTY_MULTI_AREA_CENTERS: FeatureCollection<Point, MultiAreaCenterProperties> = {
  type: "FeatureCollection",
  features: [],
};

export const EMPTY_MULTI_AREA_RADII: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

export function multiAreaItemsCollection(
  items: MultiAreaMapItem[],
): FeatureCollection<Point, MultiAreaItemProperties> {
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
          category: item.category ?? "restaurang",
        },
      })),
  };
}

export function multiAreaSelectedCollection(
  item: MultiAreaMapItem | null,
): FeatureCollection<Point, MultiAreaItemProperties> {
  if (!item || item.lat == null || item.lng == null) return EMPTY_MULTI_AREA_POINTS;
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
          category: item.category ?? "restaurang",
        },
      },
    ],
  };
}

export function multiAreaCentersCollection(
  centers: MultiAreaMapCenter[],
): FeatureCollection<Point, MultiAreaCenterProperties> {
  return {
    type: "FeatureCollection",
    features: centers.map((center) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [center.lng, center.lat] },
      properties: { id: center.id, label: center.label },
    })),
  };
}

export function multiAreaRadiiCollection(
  centers: MultiAreaMapCenter[],
  radiusKm: number,
): FeatureCollection<Polygon> {
  if (radiusKm <= 0) return EMPTY_MULTI_AREA_RADII;
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
