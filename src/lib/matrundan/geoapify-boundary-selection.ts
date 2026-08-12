import type { SearchAreaBoundaryGeometry } from "./types";

type JsonRecord = Record<string, unknown>;

export interface GeoapifyBoundarySelection {
  boundary: SearchAreaBoundaryGeometry;
  placeId: string;
}

function objectValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function comparableBoundaryName(value: string): string {
  return value
    .split(",")[0]
    ?.trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("sv-SE");
}

function boundaryGeometry(value: unknown): SearchAreaBoundaryGeometry | null {
  const geometry = objectValue(value);
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  return geometry as unknown as SearchAreaBoundaryGeometry;
}

/**
 * Väljer endast den administrativa boundary som motsvarar användarens valda
 * etikett. Det hindrar exempelvis orten "Nacka" från att oavsiktligt bli hela
 * "Nacka kommun" bara för att kommunen finns i Boundaries API:s part-of-svar.
 */
export function selectMatchingGeoapifyBoundary(
  features: unknown[] | undefined,
  selectedLabel: string,
): GeoapifyBoundarySelection | null {
  const targetName = comparableBoundaryName(selectedLabel);
  if (!targetName) return null;

  for (const feature of features ?? []) {
    const row = objectValue(feature);
    const properties = objectValue(row?.properties);
    const name = typeof properties?.name === "string" ? properties.name : "";
    const placeId =
      typeof properties?.place_id === "string" ? properties.place_id.trim() : "";
    if (!placeId || comparableBoundaryName(name) !== targetName) continue;

    const boundary = boundaryGeometry(row?.geometry);
    if (boundary) return { boundary, placeId };
  }

  return null;
}
