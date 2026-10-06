import type { PlaceSuggestion } from "./places-provider";
import type { SearchAreaBoundaryGeometry } from "./types";

export interface CanonicalPlaceCandidate {
  placeId: string;
  name: string;
  category: PlaceSuggestion["category"];
  cuisines: string[];
  address: string;
  area: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  groupStatus: "active" | "archived" | "not_linked";
  version: string;
}

export interface IdentityCandidate extends CanonicalPlaceCandidate {
  lat: number;
  lng: number;
  matchKind: "strong" | "possible";
  distanceKm: number;
  /** Server-computed; absent on older deployments means confirmation is unavailable. */
  canConfirmSource?: boolean;
}

export interface ProviderIdentityReview {
  providerPlaceId: string;
  providerVersion: string;
  knownPlace: CanonicalPlaceCandidate | null;
  candidates: IdentityCandidate[];
  reviewRequired: boolean;
  identityConflict: boolean;
}

export type PlaceDiscoveryResult =
  | (PlaceSuggestion & {
      kind: "provider";
      resultKey: string;
      identity: ProviderIdentityReview;
    })
  | (PlaceSuggestion & {
      kind: "canonical";
      resultKey: string;
      canonical: CanonicalPlaceCandidate;
    });

export type PlaceResolutionStatus =
  | "created"
  | "linked"
  | "restored"
  | "already_active"
  | "review_required"
  | "identity_conflict"
  | "verification_required";

export interface PlaceResolution {
  status: PlaceResolutionStatus;
  placeId?: string;
  candidates?: IdentityCandidate[];
  providerVersion?: string;
  provider?: PlaceSuggestion;
}

export interface CandidateDecision {
  placeId: string;
  version: string;
}

/** The same spelling contract is used by private.normalize_place_identity_v1. */
export function normalizePlaceIdentity(value: string): string {
  return value
    .toLocaleLowerCase("sv-SE")
    .replace(/&/g, " och ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\boch\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function placeDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const term =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, term))));
}

function pointOnSegment(point: number[], a: number[], b: number[]): boolean {
  const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
  return (
    Math.abs(cross) <= 1e-10 &&
    point[0] >= Math.min(a[0], b[0]) - 1e-10 &&
    point[0] <= Math.max(a[0], b[0]) + 1e-10 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-10 &&
    point[1] <= Math.max(a[1], b[1]) + 1e-10
  );
}

function ringContains(point: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (pointOnSegment(point, a, b)) return true;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function placeWithinBoundary(
  place: { lat: number; lng: number },
  boundary: SearchAreaBoundaryGeometry,
): boolean {
  const polygons =
    boundary.type === "Polygon"
      ? [boundary.coordinates as number[][][]]
      : (boundary.coordinates as number[][][][]);
  const point = [place.lng, place.lat];
  return polygons.some(
    ([outer, ...holes]) =>
      outer?.length >= 3 &&
      ringContains(point, outer) &&
      !holes.some((hole) => ringContains(point, hole)),
  );
}

/** Preserve previously shown rows and update their identity state on later pages. */
export function mergeDiscoveryPages(
  previous: PlaceDiscoveryResult[],
  next: PlaceDiscoveryResult[],
): PlaceDiscoveryResult[] {
  const merged = new Map(previous.map((row) => [row.resultKey, row]));
  for (const row of next) merged.set(row.resultKey, row);
  return [...merged.values()];
}

export class PlaceResolutionError extends Error {
  constructor(public readonly resolution: PlaceResolution) {
    super(
      resolution.status === "identity_conflict"
        ? "Kartkällorna pekar på olika ställen. Ingen ändring har sparats."
        : "Granska matchningen innan stället läggs till.",
    );
    this.name = "PlaceResolutionError";
  }
}

export function canBulkAddSuggestion(result: PlaceSuggestion): boolean {
  return (
    result.kind !== "canonical" &&
    !result.identity?.reviewRequired &&
    !result.identity?.identityConflict
  );
}
