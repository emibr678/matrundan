import { z } from "zod";

import { rpcClient } from "./rpc-client";
import type { Occasion, Place, PlaceCategory } from "./types";

export type ReusablePlaceMatchKind = "exact" | "similar";
export type ReusablePlaceGroupStatus = "active" | "archived" | "not_linked";

export interface ReusableManualPlaceCandidate {
  placeId: string;
  name: string;
  category: PlaceCategory;
  address: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  distanceKm: number;
  matchKind: ReusablePlaceMatchKind;
  groupStatus: ReusablePlaceGroupStatus;
}

export interface ReusableManualPlaceQuery {
  name: string;
  category: PlaceCategory;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

export interface ReuseManualPlaceInput extends ReusableManualPlaceQuery {
  placeId: string;
  occasions: Occasion[];
  notes?: string;
}

export interface CreateManualFallbackInput {
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  occasions: Occasion[];
  address: string;
  area?: string;
  city: string;
  lat?: number;
  lng?: number;
  notes?: string;
  photo?: string;
  declinedPlaceIds?: string[];
}

const placeCategorySchema = z.enum(["restaurang", "café", "bageri", "snabbmat", "pub", "matvagn"]);

const candidateSchema = z.object({
  placeId: z.string().uuid(),
  name: z.string(),
  category: placeCategorySchema,
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  distanceKm: z.coerce.number().nonnegative(),
  matchKind: z.enum(["exact", "similar"]),
  groupStatus: z.enum(["active", "archived", "not_linked"]),
});

const candidateListSchema = z.array(candidateSchema);
const reuseResultSchema = z.object({
  placeId: z.string().uuid(),
  status: z.enum(["linked", "restored", "existing"]),
});
const fallbackResultSchema = z.object({
  placeId: z.string().uuid(),
  improvementCandidate: z.boolean(),
});

export async function listReusableManualPlaceCandidates(
  groupId: string,
  input: ReusableManualPlaceQuery,
): Promise<ReusableManualPlaceCandidate[]> {
  return rpcClient.call(
    "find_reusable_manual_place_candidates_v1",
    {
      _group_id: groupId,
      _name: input.name,
      _address: input.address,
      _city: input.city,
      _lat: input.lat,
      _lng: input.lng,
      _category: input.category,
    },
    candidateListSchema,
    "Servern returnerade ett oväntat format för befintliga matställen.",
  );
}

export async function reuseManualPlaceInGroup(
  groupId: string,
  input: ReuseManualPlaceInput,
): Promise<{ placeId: string; status: "linked" | "restored" | "existing" }> {
  return rpcClient.call(
    "link_reusable_manual_place_v1",
    {
      _group_id: groupId,
      _place_id: input.placeId,
      _name: input.name,
      _address: input.address,
      _city: input.city,
      _lat: input.lat,
      _lng: input.lng,
      _occasions: input.occasions,
      _notes: input.notes ?? null,
    },
    reuseResultSchema,
    "Servern kunde inte bekräfta återanvändningen av matstället.",
  );
}

export async function createManualPlaceFromFallback(
  groupId: string,
  input: CreateManualFallbackInput,
): Promise<{ placeId: string; improvementCandidate: boolean }> {
  return rpcClient.call(
    "create_manual_place_fallback_v1",
    {
      _group_id: groupId,
      _name: input.name,
      _category: input.category,
      _cuisines: input.cuisines,
      _occasions: input.occasions,
      _address: input.address,
      _area: input.area ?? null,
      _city: input.city,
      _lat: input.lat ?? null,
      _lng: input.lng ?? null,
      _notes: input.notes ?? null,
      _photo_url: input.photo ?? null,
      _declined_place_ids: input.declinedPlaceIds ?? [],
    },
    fallbackResultSchema,
    "Servern kunde inte bekräfta det nya matstället.",
  );
}

export function isReusablePlaceRace(error: unknown): boolean {
  return error instanceof Error && /REUSABLE_PLACE_FOUND/i.test(error.message);
}

function normalize(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("sv-SE")
    .replace(/&/g, " och ")
    .replace(/[^a-z0-9åäö]+/gi, " ")
    .replace(/\boch\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = radians(bLat - aLat);
  const lngDelta = radians(bLng - aLng);
  const term =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, term))));
}

/**
 * Demo/exempel använder samma konservativa matchningsidé utan att läsa någon
 * annan grupp. Det gör scenariot deterministiskt och håller privat data utanför
 * klienten även i fixtures.
 */
export function listLocalReusableManualPlaceCandidates(
  places: Place[],
  input: ReusableManualPlaceQuery,
): ReusableManualPlaceCandidate[] {
  const requestedName = normalize(input.name);
  const requestedAddress = normalize(input.address);
  const requestedCity = normalize(input.city);

  return places
    .flatMap((place): ReusableManualPlaceCandidate[] => {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return [];
      if ((place.sources ?? []).some((source) => source.status === "active")) return [];

      const distance = distanceKm(input.lat, input.lng, place.lat!, place.lng!);
      if (distance > 0.15) return [];

      const candidateName = normalize(place.name);
      const candidateAddress = normalize(place.address);
      const candidateCity = normalize(place.city);
      const sameName = candidateName === requestedName;
      const sameAddress =
        Boolean(requestedAddress && candidateAddress) &&
        candidateAddress === requestedAddress &&
        (!requestedCity || !candidateCity || candidateCity === requestedCity);
      const relatedName =
        candidateName.length >= 4 &&
        requestedName.length >= 4 &&
        (sameName ||
          candidateName.startsWith(`${requestedName} `) ||
          requestedName.startsWith(`${candidateName} `));
      const matches =
        (sameName && (sameAddress || distance <= 0.1)) ||
        (relatedName && distance <= 0.1 && (sameAddress || distance <= 0.05));
      if (!matches) return [];

      return [
        {
          placeId: place.id,
          name: place.name,
          category: place.category,
          address: place.address,
          area: place.area ?? null,
          city: place.city,
          lat: place.lat!,
          lng: place.lng!,
          distanceKm: distance,
          matchKind: sameName && (sameAddress || distance <= 0.05) ? "exact" : "similar",
          groupStatus: place.collectionStatus === "archived" ? "archived" : "active",
        },
      ];
    })
    .sort((a, b) => {
      if (a.matchKind !== b.matchKind) return a.matchKind === "exact" ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 5);
}
