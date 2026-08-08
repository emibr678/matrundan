import { z } from "zod";

import { rpcClient } from "./rpc-client";
import type { PlaceCategory } from "./types";

export const PLACE_MAINTENANCE_STATUSES = ["open", "needs_osm", "resolved", "dismissed"] as const;
export type PlaceMaintenanceStatus = (typeof PLACE_MAINTENANCE_STATUSES)[number];

export const PLACE_MAINTENANCE_DISMISSAL_REASONS = [
  "not_relevant",
  "insufficient_evidence",
  "not_food_place",
  "already_handled",
] as const;
export type PlaceMaintenanceDismissalReason = (typeof PLACE_MAINTENANCE_DISMISSAL_REASONS)[number];

const categorySchema = z.enum(["restaurang", "café", "bageri", "snabbmat", "pub", "matvagn"]);
const statusSchema = z.enum(PLACE_MAINTENANCE_STATUSES);
const dismissalReasonSchema = z.enum(PLACE_MAINTENANCE_DISMISSAL_REASONS);

const activeSourceSchema = z.object({
  provider: z.string().min(1),
  providerPlaceId: z.string().min(1),
});

const candidateSchema = z.object({
  candidateId: z.string().uuid(),
  placeId: z.string().uuid(),
  reason: z.literal("unmatched_verified_manual"),
  status: statusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  dismissalReason: dismissalReasonSchema.nullable(),
  name: z.string().min(1),
  category: categorySchema,
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  website: z.string().nullable(),
  activeSource: activeSourceSchema.nullable().optional(),
});

const pageSchema = z.object({
  items: z.array(candidateSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export interface PlaceMaintenanceCandidate {
  candidateId: string;
  placeId: string;
  reason: "unmatched_verified_manual";
  status: PlaceMaintenanceStatus;
  createdAt: string;
  resolvedAt: string | null;
  dismissalReason: PlaceMaintenanceDismissalReason | null;
  name: string;
  category: PlaceCategory;
  address: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  website: string | null;
  activeSource?: { provider: string; providerPlaceId: string } | null;
}

export interface PlaceMaintenancePage {
  items: PlaceMaintenanceCandidate[];
  total: number;
  limit: number;
  offset: number;
}

export async function getPlaceMaintenanceAccess(): Promise<boolean> {
  return rpcClient.call(
    "get_place_maintenance_access_v1",
    {},
    z.boolean(),
    "Kunde inte kontrollera behörighet till Platsunderhåll.",
  );
}

export async function listPlaceMaintenanceCandidates(input?: {
  status?: PlaceMaintenanceStatus | null;
  limit?: number;
  offset?: number;
}): Promise<PlaceMaintenancePage> {
  return rpcClient.call(
    "list_place_improvement_candidates_for_maintenance_v1",
    {
      _status: input?.status ?? null,
      _limit: input?.limit ?? 50,
      _offset: input?.offset ?? 0,
    },
    pageSchema,
    "Kunde inte läsa underhållskön.",
  );
}

export async function markPlaceMaintenanceNeedsOsm(candidateId: string): Promise<void> {
  await rpcClient.call(
    "mark_place_improvement_candidate_needs_osm_v1",
    { _candidate_id: candidateId },
    z.literal("needs_osm"),
    "Kunde inte markera ärendet för OSM-åtgärd.",
  );
}

export async function dismissPlaceMaintenanceCandidate(
  candidateId: string,
  reason: PlaceMaintenanceDismissalReason,
): Promise<void> {
  await rpcClient.call(
    "dismiss_place_improvement_candidate_v1",
    { _candidate_id: candidateId, _reason: reason },
    z.literal("dismissed"),
    "Kunde inte avfärda underhållsärendet.",
  );
}

export const PLACE_MAINTENANCE_DISMISSAL_LABEL: Record<PlaceMaintenanceDismissalReason, string> = {
  not_relevant: "Inte relevant",
  insufficient_evidence: "Otillräckligt underlag",
  not_food_place: "Inte ett matställe",
  already_handled: "Redan hanterat",
};
